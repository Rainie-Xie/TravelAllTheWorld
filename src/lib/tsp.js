/*
 * Route ordering with fixed start/end, opening hours and locked positions.
 *
 * Index convention for the travel matrix T (minutes):
 *   0           = start point
 *   1..n        = places
 *   n+1         = end point (only when hasEnd)
 *
 * places[i] = { stay, open, close, lock }   (minutes since midnight; lock = 1-based position or null)
 *
 * ≤ 12 places → exact Held-Karp DP minimising finish time (travel + waiting).
 * More places → nearest-neighbour + 2-opt on travel time.
 */

const EXACT_LIMIT = 12

function popcount(x) {
  let c = 0
  while (x) { x &= x - 1; c++ }
  return c
}

function arrive(prevDepart, travel, p, strict) {
  let a = prevDepart + travel
  if (p.open != null && a < p.open) a = p.open
  if (strict && p.close != null && a + Math.min(p.stay, 45) > p.close) return Infinity
  return a
}

function exactOrder(places, T, startMin, hasEnd, strict) {
  const n = places.length
  const size = 1 << n
  const dp = new Float64Array(size * n).fill(Infinity)
  const par = new Int8Array(size * n).fill(-1)
  const lockAt = new Array(n + 2).fill(-1)
  places.forEach((p, i) => { if (p.lock) lockAt[p.lock] = i })
  const allowed = (k, pos) => (lockAt[pos] !== -1 ? lockAt[pos] === k : !places[k].lock || places[k].lock === pos)

  for (let j = 0; j < n; j++) {
    if (!allowed(j, 1)) continue
    const a = arrive(startMin, T[0][j + 1], places[j], strict)
    if (a < Infinity) dp[(1 << j) * n + j] = a + places[j].stay
  }
  for (let mask = 1; mask < size; mask++) {
    const pos = popcount(mask) + 1
    for (let j = 0; j < n; j++) {
      const cur = dp[mask * n + j]
      if (cur === Infinity) continue
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k) || !allowed(k, pos)) continue
        const a = arrive(cur, T[j + 1][k + 1], places[k], strict)
        if (a === Infinity) continue
        const fin = a + places[k].stay
        const idx = (mask | (1 << k)) * n + k
        if (fin < dp[idx]) { dp[idx] = fin; par[idx] = j }
      }
    }
  }
  const full = size - 1
  let best = Infinity, last = -1
  for (let j = 0; j < n; j++) {
    const v = dp[full * n + j]
    if (v === Infinity) continue
    const total = v + (hasEnd ? T[j + 1][n + 1] : 0)
    if (total < best) { best = total; last = j }
  }
  if (last === -1) return null
  const order = []
  let mask = full, j = last
  while (j !== -1) {
    order.push(j)
    const p = par[mask * n + j]
    mask &= ~(1 << j)
    j = p
  }
  return order.reverse()
}

function heuristicOrder(places, T, hasEnd) {
  const n = places.length
  const free = places.map((_, i) => i).filter((i) => !places[i].lock)
  // nearest neighbour
  const route = []
  let cur = 0
  const left = new Set(free)
  while (left.size) {
    let best = -1, bd = Infinity
    for (const k of left) if (T[cur][k + 1] < bd) { bd = T[cur][k + 1]; best = k }
    route.push(best); left.delete(best); cur = best + 1
  }
  // 2-opt with fixed endpoints
  const node = (r, i) => (i < 0 ? 0 : i >= r.length ? (hasEnd ? n + 1 : -1) : r[i] + 1)
  const d = (a, b) => (a === -1 || b === -1 ? 0 : T[a][b])
  let improved = true, guard = 0
  while (improved && guard++ < 60) {
    improved = false
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const a = node(route, i - 1), b = node(route, i), c = node(route, k), e = node(route, k + 1)
        const delta = d(a, c) + d(b, e) - d(a, b) - d(c, e)
        if (delta < -0.01) {
          route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse())
          improved = true
        }
      }
    }
  }
  // re-insert locked places at their positions
  const locked = places.map((p, i) => [p.lock, i]).filter(([l]) => l).sort((a, b) => a[0] - b[0])
  for (const [pos, i] of locked) route.splice(Math.min(pos - 1, route.length), 0, i)
  return route
}

export function solveOrder(places, T, startMin, hasEnd) {
  if (places.length === 0) return { order: [], relaxed: false }
  if (places.length <= EXACT_LIMIT) {
    const strict = exactOrder(places, T, startMin, hasEnd, true)
    if (strict) return { order: strict, relaxed: false }
    return { order: exactOrder(places, T, startMin, hasEnd, false) || places.map((_, i) => i), relaxed: true }
  }
  return { order: heuristicOrder(places, T, hasEnd), relaxed: true }
}

// Builds the timeline for a given order (indices into places)
export function timeline(order, places, T, D, startMin, hasEnd, overhead = 0) {
  const steps = []
  let t = startMin, prev = 0, travelTotal = 0, distTotal = 0
  for (const i of order) {
    const p = places[i]
    const travel = T[prev][i + 1] + overhead
    travelTotal += travel
    distTotal += D ? D[prev][i + 1] : 0
    let a = t + travel
    let wait = 0
    if (p.open != null && a < p.open) { wait = p.open - a; a = p.open }
    const late = p.close != null && a + Math.min(p.stay, 45) > p.close
    const depart = a + p.stay
    steps.push({ index: i, travel, dist: D ? D[prev][i + 1] : null, arrive: a, wait, depart, late })
    t = depart
    prev = i + 1
  }
  let endArrive = t, endTravel = 0, endDist = 0
  if (hasEnd) {
    endTravel = T[prev][places.length + 1] + overhead
    endDist = D ? D[prev][places.length + 1] : 0
    endArrive = t + endTravel
    travelTotal += endTravel
    distTotal += endDist
  }
  return { steps, endArrive, endTravel, endDist, travelTotal, distTotal }
}
