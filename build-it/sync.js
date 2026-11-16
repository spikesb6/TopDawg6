/* Cloud sync rules for the web app. Same rules as mobile/src/lib/sync.ts; mobile/src/lib/sync-web.test.ts
   runs this file against the same cases so the two can't drift apart. */
var BUILDIT_SYNC = (function () {
  function unionById(mine, theirs) {
    var ids = {};
    mine.forEach(function (x) { ids[x.id] = true; });
    return mine.concat(theirs.filter(function (x) { return !ids[x.id]; }));
  }

  /* Combines two builds that both changed. Nothing is thrown away; where both set the same thing, this device wins. */
  function mergeBuilds(mine, theirs) {
    var theirPhotos = theirs.photos || [];
    return Object.assign({}, mine, {
      done: Object.assign({}, theirs.done, mine.done),
      notes: Object.assign({}, theirs.notes, mine.notes),
      lot: Object.assign({}, theirs.lot, mine.lot),
      permits: Object.assign({}, theirs.permits, mine.permits),
      vet: Object.assign({}, theirs.vet, mine.vet),
      payments: unionById(mine.payments || [], theirs.payments || []),
      photos: unionById(mine.photos || [], theirPhotos).map(function (p) {
        var uploaded = p.uploaded || theirPhotos.some(function (t) { return t.id === p.id && t.uploaded; });
        return Object.assign({}, p, { uploaded: uploaded });
      })
    });
  }

  /* dirty: this device changed something since its last sync. knownVersion: the account version it last saw.
     normalize fills in fields an older save is missing. */
  function planSync(local, dirty, knownVersion, remote, normalize) {
    if (!remote) return { action: "create", data: local };
    if (remote.version === knownVersion) {
      return dirty ? { action: "push", data: local, expectVersion: remote.version } : { action: "none" };
    }
    var theirs = normalize(remote.data);
    if (!dirty) return { action: "pull", data: theirs, version: remote.version };
    return { action: "push", data: mergeBuilds(local, theirs), expectVersion: remote.version };
  }

  return { planSync: planSync, mergeBuilds: mergeBuilds };
})();
