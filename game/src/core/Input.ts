/**
 * Action-mapped input, modelled on Unreal's Enhanced Input.
 *
 * The critical architectural property here is that the simulation NEVER touches
 * a keyboard, gamepad or DOM event. It consumes `InputFrame` structs. A human
 * at a keyboard, the Veyron AI, and a scripted Playwright test bot all produce
 * the same struct, which is what lets every combat scenario be replayed
 * headlessly and deterministically.
 */

export type ActionName =
  | 'light'
  | 'heavy'
  | 'guard'
  | 'dodge'
  | 'jump'
  | 'descend'
  | 'boost'
  | 'lockOn'
  | 'charge'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'transform'
  | 'ultimate';

export const ALL_ACTIONS: readonly ActionName[] = [
  'light', 'heavy', 'guard', 'dodge', 'jump', 'descend', 'boost',
  'lockOn', 'charge', 'ability1', 'ability2', 'ability3', 'ability4',
  'transform', 'ultimate',
];

/** One simulation frame of intent. All fields are absolute state, not events. */
export interface InputFrame {
  /** Analog stick, camera-relative. Magnitude clamped to 1. */
  moveX: number;
  moveZ: number;
  /** Camera yaw the movement should be interpreted against (radians). */
  cameraYaw: number;
  held: Record<ActionName, boolean>;
}

export function emptyInputFrame(): InputFrame {
  const held = {} as Record<ActionName, boolean>;
  for (const a of ALL_ACTIONS) held[a] = false;
  return { moveX: 0, moveZ: 0, cameraYaw: 0, held };
}

export function copyInputFrame(src: InputFrame, dst: InputFrame): void {
  dst.moveX = src.moveX;
  dst.moveZ = src.moveZ;
  dst.cameraYaw = src.cameraYaw;
  for (const a of ALL_ACTIONS) dst.held[a] = src.held[a];
}

/**
 * Per-fighter input state: edge detection plus a rolling press buffer.
 *
 * Input buffering is a core combat-feel requirement. A press made during an
 * attack's recovery is remembered for BUFFER_FRAMES so the next attack fires
 * the instant the window opens, instead of being dropped. Without this the
 * game feels unresponsive no matter how fast the animations are.
 */
export class InputState {
  /** ~133ms at 60Hz. Long enough to feel forgiving, short enough to not misfire. */
  static readonly BUFFER_FRAMES = 8;

  readonly current: InputFrame = emptyInputFrame();
  private previous: InputFrame = emptyInputFrame();

  /** Frame index at which each action was last pressed. -Infinity if never. */
  private pressedAt: Record<ActionName, number>;
  /** Frames each action has been continuously held. */
  private heldFor: Record<ActionName, number>;
  /** Actions already consumed from the buffer, so one press never fires twice. */
  private consumedAt: Record<ActionName, number>;

  private frame = 0;

  constructor() {
    this.pressedAt = {} as Record<ActionName, number>;
    this.heldFor = {} as Record<ActionName, number>;
    this.consumedAt = {} as Record<ActionName, number>;
    for (const a of ALL_ACTIONS) {
      this.pressedAt[a] = -Infinity;
      this.heldFor[a] = 0;
      this.consumedAt[a] = -Infinity;
    }
  }

  /** Advance one simulation frame with fresh intent. */
  tick(next: InputFrame): void {
    copyInputFrame(this.current, this.previous);
    copyInputFrame(next, this.current);
    this.frame++;
    for (const a of ALL_ACTIONS) {
      if (this.current.held[a]) {
        if (!this.previous.held[a]) this.pressedAt[a] = this.frame;
        this.heldFor[a]++;
      } else {
        this.heldFor[a] = 0;
      }
    }
  }

  get frameIndex(): number {
    return this.frame;
  }

  /** True only on the frame the action went down. */
  pressed(a: ActionName): boolean {
    return this.current.held[a] && !this.previous.held[a];
  }

  released(a: ActionName): boolean {
    return !this.current.held[a] && this.previous.held[a];
  }

  held(a: ActionName): boolean {
    return this.current.held[a];
  }

  heldFrames(a: ActionName): number {
    return this.heldFor[a];
  }

  /**
   * True if the action was pressed within the buffer window and has not yet
   * been consumed. Callers that act on it MUST call `consume` so a single
   * press cannot trigger two moves.
   */
  buffered(a: ActionName, window = InputState.BUFFER_FRAMES): boolean {
    const at = this.pressedAt[a];
    if (at === -Infinity) return false;
    if (this.consumedAt[a] >= at) return false;
    return this.frame - at <= window;
  }

  consume(a: ActionName): void {
    this.consumedAt[a] = this.pressedAt[a];
  }

  /** Buffered-and-consume in one call — the common case. */
  take(a: ActionName, window = InputState.BUFFER_FRAMES): boolean {
    if (!this.buffered(a, window)) return false;
    this.consume(a);
    return true;
  }

  /** Drop every pending press. Used on state resets (match restart, KO). */
  clearBuffer(): void {
    for (const a of ALL_ACTIONS) this.consumedAt[a] = this.pressedAt[a];
  }

  get moveMagnitude(): number {
    const { moveX, moveZ } = this.current;
    return Math.min(1, Math.hypot(moveX, moveZ));
  }

  hasMoveInput(deadzone = 0.15): boolean {
    return this.moveMagnitude > deadzone;
  }
}
