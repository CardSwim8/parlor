/* Slide Rule solver, run as a background worker so the board stays responsive.
   In:  { walls: [256], robots: [4 cells], target: cell, color: robot index, or -1 for "any robot" }
   Out: { moves: [[robot, dir], ...] } with the fewest moves, or { moves: null } if none found in time.
   Search: iterative deepening, pruned by a lower bound (how many straight slides the robot would
   need if it could stop anywhere) and a table of positions already reached in fewer moves. */
"use strict";
var BIT = [1, 2, 4, 8], STEP = [-16, 1, 16, -1]; // N E S W
var LIMIT_DEPTH = 30, LIMIT_MS = 20000;

self.onmessage = function(e){
  var q = e.data;
  self.postMessage({ moves: solve(q.walls, q.robots.slice(), q.target, q.color) });
};

function solve(walls, robots, target, color){
  // lower bound per cell: fewest straight slides to the target, ignoring other robots
  var dist = new Array(256).fill(Infinity), queue = [target];
  dist[target] = 0;
  for (var qi = 0; qi < queue.length; qi++){
    var y = queue[qi];
    for (var d = 0; d < 4; d++){
      var x = y;
      while (!(walls[x] & BIT[d])){
        x += STEP[d];
        if (dist[x] === Infinity){ dist[x] = dist[y] + 1; queue.push(x); }
      }
    }
  }
  function h(){
    if (color >= 0) return dist[robots[color]];
    return Math.min(dist[robots[0]], dist[robots[1]], dist[robots[2]], dist[robots[3]]);
  }
  function slide(r, d){
    var p = robots[r];
    for (;;){
      if (walls[p] & BIT[d]) return p;
      var n = p + STEP[d];
      if (n === robots[0] || n === robots[1] || n === robots[2] || n === robots[3]) return p;
      p = n;
    }
  }
  function key(){
    // robots other than the one that has to reach the target are interchangeable for the search
    if (color < 0) return robots.slice().sort(function(a, b){ return a - b; }).join(",");
    var others = robots.filter(function(_, i){ return i !== color; }).sort(function(a, b){ return a - b; });
    return robots[color] + ":" + others.join(",");
  }
  var path = [], seen, limit, t0 = Date.now(), timedOut = false, nodes = 0;
  function dfs(g, lastR, lastD){
    var est = h();
    if (est === 0) return true;
    if (g + est > limit) return false;
    if ((++nodes & 4095) === 0 && Date.now() - t0 > LIMIT_MS){ timedOut = true; return false; }
    var k = key(), prev = seen.get(k);
    if (prev !== undefined && prev <= g) return false;
    seen.set(k, g);
    for (var r = 0; r < 4; r++){
      for (var d = 0; d < 4; d++){
        if (r === lastR && d === lastD) continue; // it's already against whatever stopped it
        var from = robots[r], to = slide(r, d);
        if (to === from) continue;
        robots[r] = to; path.push([r, d]);
        if (dfs(g + 1, r, d)) return true;
        robots[r] = from; path.pop();
        if (timedOut) return false;
      }
    }
    return false;
  }
  var start = h();
  if (start === Infinity) return null;
  for (limit = start; limit <= LIMIT_DEPTH; limit++){
    seen = new Map();
    if (dfs(0, -1, -1)) return path;
    if (timedOut) return null;
  }
  return null;
}
