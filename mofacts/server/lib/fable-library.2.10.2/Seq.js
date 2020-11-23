"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEnumerator = getEnumerator;
exports.toIterator = toIterator;
exports.ofArray = ofArray;
exports.allPairs = allPairs;
exports.append = append;
exports.average = average;
exports.averageBy = averageBy;
exports.concat = concat;
exports.collect = collect;
exports.choose = choose;
exports.compareWith = compareWith;
exports.delay = delay;
exports.empty = empty;
exports.singleton = singleton;
exports.enumerateFromFunctions = enumerateFromFunctions;
exports.enumerateWhile = enumerateWhile;
exports.enumerateThenFinally = enumerateThenFinally;
exports.enumerateUsing = enumerateUsing;
exports.exactlyOne = exactlyOne;
exports.except = except;
exports.exists = exists;
exports.exists2 = exists2;
exports.forAll = forAll;
exports.forAll2 = forAll2;
exports.contains = contains;
exports.filter = filter;
exports.where = where;
exports.fold = fold;
exports.foldBack = foldBack;
exports.fold2 = fold2;
exports.foldBack2 = foldBack2;
exports.tryHead = tryHead;
exports.head = head;
exports.initialize = initialize;
exports.initializeInfinite = initializeInfinite;
exports.tryItem = tryItem;
exports.item = item;
exports.iterate = iterate;
exports.iterate2 = iterate2;
exports.iterateIndexed = iterateIndexed;
exports.iterateIndexed2 = iterateIndexed2;
exports.isEmpty = isEmpty;
exports.tryLast = tryLast;
exports.last = last;
exports.length = length;
exports.map = map;
exports.mapIndexed = mapIndexed;
exports.indexed = indexed;
exports.map2 = map2;
exports.mapIndexed2 = mapIndexed2;
exports.map3 = map3;
exports.mapFold = mapFold;
exports.mapFoldBack = mapFoldBack;
exports.max = max;
exports.maxBy = maxBy;
exports.min = min;
exports.minBy = minBy;
exports.pairwise = pairwise;
exports.rangeChar = rangeChar;
exports.rangeLong = rangeLong;
exports.rangeDecimal = rangeDecimal;
exports.rangeNumber = rangeNumber;
exports.readOnly = readOnly;
exports.reduce = reduce;
exports.reduceBack = reduceBack;
exports.replicate = replicate;
exports.reverse = reverse;
exports.scan = scan;
exports.scanBack = scanBack;
exports.skip = skip;
exports.skipWhile = skipWhile;
exports.sortWith = sortWith;
exports.sum = sum;
exports.sumBy = sumBy;
exports.tail = tail;
exports.take = take;
exports.truncate = truncate;
exports.takeWhile = takeWhile;
exports.tryFind = tryFind;
exports.find = find;
exports.tryFindBack = tryFindBack;
exports.findBack = findBack;
exports.tryFindIndex = tryFindIndex;
exports.findIndex = findIndex;
exports.tryFindIndexBack = tryFindIndexBack;
exports.findIndexBack = findIndexBack;
exports.tryPick = tryPick;
exports.pick = pick;
exports.unfold = unfold;
exports.zip = zip;
exports.zip3 = zip3;
exports.windowed = windowed;
exports.transpose = transpose;
exports.Enumerator = void 0;

var _Decimal = require("./Decimal");

var _Long = require("./Long");

var _Option = require("./Option");

var _Util = require("./Util");

class Enumerator {
  constructor(iter) {
    this.iter = iter;
  }

  MoveNext() {
    const cur = this.iter.next();
    this.current = cur.value;
    return !cur.done;
  }

  get Current() {
    return this.current;
  }

  Reset() {
    throw new Error("JS iterators cannot be reset");
  }

  Dispose() {
    return;
  }

}

exports.Enumerator = Enumerator;

function getEnumerator(o) {
  return new Enumerator(o[Symbol.iterator]());
}

function toIterator(en) {
  return {
    next() {
      return en.MoveNext() ? {
        done: false,
        value: en.Current
      } : {
        done: true,
        value: undefined
      };
    }

  };
} // export function toIterable<T>(en: IEnumerable<T>): Iterable<T> {
//   return {
//     [Symbol.iterator]() {
//       return toIterator(en.GetEnumerator());
//     },
//   };
// }


function __failIfNone(res) {
  if (res == null) {
    throw new Error("Seq did not contain any matching element");
  }

  return (0, _Option.value)(res);
}

function makeSeq(f) {
  const seq = {
    [Symbol.iterator]: f,
    toString: () => "seq [" + Array.from(seq).join("; ") + "]"
  };
  return seq;
}

function ofArray(xs) {
  return delay(() => unfold(i => i != null && i < xs.length ? [xs[i], i + 1] : undefined, 0));
}

function allPairs(xs, ys) {
  let firstEl = true;
  const ysCache = [];
  return collect(x => {
    if (firstEl) {
      firstEl = false;
      return map(y => {
        ysCache.push(y);
        return [x, y];
      }, ys);
    } else {
      return ysCache.map(y => [x, y]); // return map(function (i) {
      //     return [x, ysCache[i]];
      // }, rangeNumber(0, 1, ysCache.length - 1));
    }
  }, xs);
}

function append(xs, ys) {
  return delay(() => {
    let firstDone = false;
    const i = xs[Symbol.iterator]();
    let iters = [i, undefined];
    return unfold(() => {
      var _a, _b;

      let cur;

      if (!firstDone) {
        cur = (_a = iters[0]) === null || _a === void 0 ? void 0 : _a.next();

        if (cur != null && !cur.done) {
          return [cur.value, iters];
        } else {
          firstDone = true;
          iters = [undefined, ys[Symbol.iterator]()];
        }
      }

      cur = (_b = iters[1]) === null || _b === void 0 ? void 0 : _b.next();
      return cur != null && !cur.done ? [cur.value, iters] : undefined;
    }, iters);
  });
}

function average(xs, averager) {
  let count = 0;
  const total = fold((acc, x) => {
    count++;
    return averager.Add(acc, x);
  }, averager.GetZero(), xs);
  return averager.DivideByInt(total, count);
}

function averageBy(f, xs, averager) {
  let count = 0;
  const total = fold((acc, x) => {
    count++;
    return averager.Add(acc, f(x));
  }, averager.GetZero(), xs);
  return averager.DivideByInt(total, count);
}

function concat(xs) {
  return delay(() => {
    const iter = xs[Symbol.iterator]();
    let output;
    return unfold(innerIter => {
      let hasFinished = false;

      while (!hasFinished) {
        if (innerIter == null) {
          const cur = iter.next();

          if (!cur.done) {
            innerIter = cur.value[Symbol.iterator]();
          } else {
            hasFinished = true;
          }
        } else {
          const cur = innerIter.next();

          if (!cur.done) {
            output = cur.value;
            hasFinished = true;
          } else {
            innerIter = undefined;
          }
        }
      }

      return innerIter != null ? [output, innerIter] : undefined;
    }, undefined);
  });
}

function collect(f, xs) {
  return concat(map(f, xs));
}

function choose(f, xs) {
  return delay(() => unfold(iter => {
    let cur = iter.next();

    while (!cur.done) {
      const y = f(cur.value);

      if (y != null) {
        return [(0, _Option.value)(y), iter];
      }

      cur = iter.next();
    }

    return undefined;
  }, xs[Symbol.iterator]()));
}

function compareWith(f, xs, ys) {
  const nonZero = tryFind(i => i !== 0, map2(f, xs, ys));
  return nonZero != null ? (0, _Option.value)(nonZero) : length(xs) - length(ys);
}

function delay(f) {
  return makeSeq(() => f()[Symbol.iterator]());
}

function empty() {
  return [];
}

function singleton(y) {
  return [y];
}

function enumerateFromFunctions(factory, moveNext, current) {
  return delay(() => unfold(e => moveNext(e) ? [current(e), e] : undefined, factory()));
}

function enumerateWhile(cond, xs) {
  return concat(unfold(() => cond() ? [xs, true] : undefined, undefined));
}

function enumerateThenFinally(xs, finalFn) {
  return delay(() => {
    let iter;

    try {
      iter = xs[Symbol.iterator]();
    } catch (err) {
      try {
        return empty();
      } finally {
        finalFn();
      }
    }

    return unfold(it => {
      try {
        const cur = it.next();
        return !cur.done ? [cur.value, it] : undefined;
      } catch (err) {
        return undefined;
      } finally {
        finalFn();
      }
    }, iter);
  });
}

function enumerateUsing(disp, work) {
  let isDisposed = false;

  const disposeOnce = () => {
    if (!isDisposed) {
      isDisposed = true;
      disp.Dispose();
    }
  };

  try {
    return enumerateThenFinally(work(disp), disposeOnce);
  } catch (err) {
    return void 0;
  } finally {
    disposeOnce();
  }
}

function exactlyOne(xs) {
  const iter = xs[Symbol.iterator]();
  const fst = iter.next();

  if (fst.done) {
    throw new Error("Seq was empty");
  }

  const snd = iter.next();

  if (!snd.done) {
    throw new Error("Seq had multiple items");
  }

  return fst.value;
}

function except(itemsToExclude, source) {
  const exclusionItems = Array.from(itemsToExclude);

  const testIsNotInExclusionItems = element => !exclusionItems.some(excludedItem => (0, _Util.equals)(excludedItem, element));

  return filter(testIsNotInExclusionItems, source);
}

function exists(f, xs) {
  let cur;

  for (const iter = xs[Symbol.iterator]();;) {
    cur = iter.next();

    if (cur.done) {
      break;
    }

    if (f(cur.value)) {
      return true;
    }
  }

  return false;
}

function exists2(f, xs, ys) {
  let cur1;
  let cur2;

  for (const iter1 = xs[Symbol.iterator](), iter2 = ys[Symbol.iterator]();;) {
    cur1 = iter1.next();
    cur2 = iter2.next();

    if (cur1.done || cur2.done) {
      break;
    }

    if (f(cur1.value, cur2.value)) {
      return true;
    }
  }

  return false;
}

function forAll(f, xs) {
  return !exists(x => !f(x), xs);
}

function forAll2(f, xs, ys) {
  return !exists2((x, y) => !f(x, y), xs, ys);
}

function contains(i, xs) {
  return exists(x => (0, _Util.equals)(x, i), xs);
}

function filter(f, xs) {
  return delay(() => unfold(iter => {
    let cur = iter.next();

    while (!cur.done) {
      if (f(cur.value)) {
        return [cur.value, iter];
      }

      cur = iter.next();
    }

    return undefined;
  }, xs[Symbol.iterator]()));
}

function where(f, xs) {
  return filter(f, xs);
}

function fold(f, acc, xs) {
  if (Array.isArray(xs) || ArrayBuffer.isView(xs)) {
    return xs.reduce(f, acc);
  } else {
    let cur;

    for (let i = 0, iter = xs[Symbol.iterator]();; i++) {
      cur = iter.next();

      if (cur.done) {
        break;
      }

      acc = f(acc, cur.value, i);
    }

    return acc;
  }
}

function foldBack(f, xs, acc) {
  const arr = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs : Array.from(xs);

  for (let i = arr.length - 1; i >= 0; i--) {
    acc = f(arr[i], acc, i);
  }

  return acc;
}

function fold2(f, acc, xs, ys) {
  const iter1 = xs[Symbol.iterator]();
  const iter2 = ys[Symbol.iterator]();
  let cur1;
  let cur2;

  for (let i = 0;; i++) {
    cur1 = iter1.next();
    cur2 = iter2.next();

    if (cur1.done || cur2.done) {
      break;
    }

    acc = f(acc, cur1.value, cur2.value, i);
  }

  return acc;
}

function foldBack2(f, xs, ys, acc) {
  const ar1 = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs : Array.from(xs);
  const ar2 = Array.isArray(ys) || ArrayBuffer.isView(ys) ? ys : Array.from(ys);

  for (let i = ar1.length - 1; i >= 0; i--) {
    acc = f(ar1[i], ar2[i], acc, i);
  }

  return acc;
}

function tryHead(xs) {
  const iter = xs[Symbol.iterator]();
  const cur = iter.next();
  return cur.done ? undefined : (0, _Option.some)(cur.value);
}

function head(xs) {
  return __failIfNone(tryHead(xs));
}

function initialize(n, f) {
  return delay(() => unfold(i => i < n ? [f(i), i + 1] : undefined, 0));
}

function initializeInfinite(f) {
  return delay(() => unfold(i => [f(i), i + 1], 0));
}

function tryItem(i, xs) {
  if (i < 0) {
    return undefined;
  }

  if (Array.isArray(xs) || ArrayBuffer.isView(xs)) {
    return i < xs.length ? (0, _Option.some)(xs[i]) : undefined;
  }

  for (let j = 0, iter = xs[Symbol.iterator]();; j++) {
    const cur = iter.next();

    if (cur.done) {
      break;
    }

    if (j === i) {
      return (0, _Option.some)(cur.value);
    }
  }

  return undefined;
}

function item(i, xs) {
  return __failIfNone(tryItem(i, xs));
}

function iterate(f, xs) {
  fold((_, x) => (f(x), undefined), undefined, xs);
}

function iterate2(f, xs, ys) {
  fold2((_, x, y) => (f(x, y), undefined), undefined, xs, ys);
}

function iterateIndexed(f, xs) {
  fold((_, x, i) => (f(i !== null && i !== void 0 ? i : 0, x), undefined), undefined, xs);
}

function iterateIndexed2(f, xs, ys) {
  fold2((_, x, y, i) => (f(i !== null && i !== void 0 ? i : 0, x, y), undefined), undefined, xs, ys);
}

function isEmpty(xs) {
  const i = xs[Symbol.iterator]();
  return i.next().done;
}

function tryLast(xs) {
  return isEmpty(xs) ? undefined : (0, _Option.some)(reduce((_, x) => x, xs));
}

function last(xs) {
  return __failIfNone(tryLast(xs));
}

function length(xs) {
  return Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs.length : fold((acc, _x) => acc + 1, 0, xs);
}

function map(f, xs) {
  return delay(() => unfold(iter => {
    const cur = iter.next();
    return !cur.done ? [f(cur.value), iter] : undefined;
  }, xs[Symbol.iterator]()));
}

function mapIndexed(f, xs) {
  return delay(() => {
    let i = 0;
    return unfold(iter => {
      const cur = iter.next();
      return !cur.done ? [f(i++, cur.value), iter] : undefined;
    }, xs[Symbol.iterator]());
  });
}

function indexed(xs) {
  return mapIndexed((i, x) => [i, x], xs);
}

function map2(f, xs, ys) {
  return delay(() => {
    const iter1 = xs[Symbol.iterator]();
    const iter2 = ys[Symbol.iterator]();
    return unfold(() => {
      const cur1 = iter1.next();
      const cur2 = iter2.next();
      return !cur1.done && !cur2.done ? [f(cur1.value, cur2.value), undefined] : undefined;
    }, undefined);
  });
}

function mapIndexed2(f, xs, ys) {
  return delay(() => {
    let i = 0;
    const iter1 = xs[Symbol.iterator]();
    const iter2 = ys[Symbol.iterator]();
    return unfold(() => {
      const cur1 = iter1.next();
      const cur2 = iter2.next();
      return !cur1.done && !cur2.done ? [f(i++, cur1.value, cur2.value), undefined] : undefined;
    }, undefined);
  });
}

function map3(f, xs, ys, zs) {
  return delay(() => {
    const iter1 = xs[Symbol.iterator]();
    const iter2 = ys[Symbol.iterator]();
    const iter3 = zs[Symbol.iterator]();
    return unfold(() => {
      const cur1 = iter1.next();
      const cur2 = iter2.next();
      const cur3 = iter3.next();
      return !cur1.done && !cur2.done && !cur3.done ? [f(cur1.value, cur2.value, cur3.value), undefined] : undefined;
    }, undefined);
  });
}

function mapFold(f, acc, xs, transform) {
  const result = [];
  let r;
  let cur;

  for (let i = 0, iter = xs[Symbol.iterator]();; i++) {
    cur = iter.next();

    if (cur.done) {
      break;
    }

    [r, acc] = f(acc, cur.value);
    result.push(r);
  }

  return transform !== void 0 ? [transform(result), acc] : [result, acc];
}

function mapFoldBack(f, xs, acc, transform) {
  const arr = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs : Array.from(xs);
  const result = [];
  let r;

  for (let i = arr.length - 1; i >= 0; i--) {
    [r, acc] = f(arr[i], acc);
    result.push(r);
  }

  return transform !== void 0 ? [transform(result), acc] : [result, acc];
}

function max(xs, comparer) {
  const compareFn = comparer != null ? comparer.Compare : _Util.compare;
  return reduce((acc, x) => compareFn(acc, x) === 1 ? acc : x, xs);
}

function maxBy(f, xs, comparer) {
  const compareFn = comparer != null ? comparer.Compare : _Util.compare;
  return reduce((acc, x) => compareFn(f(acc), f(x)) === 1 ? acc : x, xs);
}

function min(xs, comparer) {
  const compareFn = comparer != null ? comparer.Compare : _Util.compare;
  return reduce((acc, x) => compareFn(acc, x) === -1 ? acc : x, xs);
}

function minBy(f, xs, comparer) {
  const compareFn = comparer != null ? comparer.Compare : _Util.compare;
  return reduce((acc, x) => compareFn(f(acc), f(x)) === -1 ? acc : x, xs);
}

function pairwise(xs) {
  return delay(() => {
    const iter = xs[Symbol.iterator]();
    const cur = iter.next();

    if (cur.done) {
      return empty();
    }

    const hd = cur.value;
    const tl = tail(xs);
    const ys = scan(([_, last], next) => [last, next], [hd, hd], tl);
    return skip(1, ys);
  });
}

function rangeChar(first, last) {
  return delay(() => unfold(x => x <= last ? [x, String.fromCharCode(x.charCodeAt(0) + 1)] : undefined, first));
}

function rangeLong(first, step, last, unsigned) {
  const stepFn = (0, _Long.makeRangeStepFunction)(step, last, unsigned);
  return delay(() => unfold(stepFn, first));
}

function rangeDecimal(first, step, last) {
  const stepFn = (0, _Decimal.makeRangeStepFunction)(step, last);
  return delay(() => unfold(stepFn, first));
}

function rangeNumber(first, step, last) {
  if (step === 0) {
    throw new Error("Step cannot be 0");
  }

  return delay(() => unfold(x => step > 0 && x <= last || step < 0 && x >= last ? [x, x + step] : undefined, first));
}

function readOnly(xs) {
  return map(x => x, xs);
}

function reduce(f, xs) {
  if (Array.isArray(xs) || ArrayBuffer.isView(xs)) {
    return xs.reduce(f);
  }

  const iter = xs[Symbol.iterator]();
  let cur = iter.next();

  if (cur.done) {
    throw new Error("Seq was empty");
  }

  let acc = cur.value;

  while (true) {
    cur = iter.next();

    if (cur.done) {
      break;
    }

    acc = f(acc, cur.value);
  }

  return acc;
}

function reduceBack(f, xs) {
  const ar = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs : Array.from(xs);

  if (ar.length === 0) {
    throw new Error("Seq was empty");
  }

  let acc = ar[ar.length - 1];

  for (let i = ar.length - 2; i >= 0; i--) {
    acc = f(ar[i], acc, i);
  }

  return acc;
}

function replicate(n, x) {
  return initialize(n, () => x);
}

function reverse(xs) {
  const ar = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs.slice(0) : Array.from(xs);
  return ofArray(ar.reverse());
}

function scan(f, seed, xs) {
  return delay(() => {
    const iter = xs[Symbol.iterator]();
    return unfold(acc => {
      if (acc == null) {
        return [seed, seed];
      }

      const cur = iter.next();

      if (!cur.done) {
        acc = f(acc, cur.value);
        return [acc, acc];
      }

      return undefined;
    }, undefined);
  });
}

function scanBack(f, xs, seed) {
  return reverse(scan((acc, x) => f(x, acc), seed, reverse(xs)));
}

function skip(n, xs) {
  return makeSeq(() => {
    const iter = xs[Symbol.iterator]();

    for (let i = 1; i <= n; i++) {
      if (iter.next().done) {
        throw new Error("Seq has not enough elements");
      }
    }

    return iter;
  });
}

function skipWhile(f, xs) {
  return delay(() => {
    let hasPassed = false;
    return filter(x => hasPassed || (hasPassed = !f(x)), xs);
  });
}

function sortWith(f, xs) {
  const ys = Array.from(xs);
  return ofArray(ys.sort(f));
}

function sum(xs, adder) {
  return fold((acc, x) => adder.Add(acc, x), adder.GetZero(), xs);
}

function sumBy(f, xs, adder) {
  return fold((acc, x) => adder.Add(acc, f(x)), adder.GetZero(), xs);
}

function tail(xs) {
  return skip(1, xs);
}

function take(n, xs, truncate = false) {
  return delay(() => {
    const iter = xs[Symbol.iterator]();
    return unfold(i => {
      if (i < n) {
        const cur = iter.next();

        if (!cur.done) {
          return [cur.value, i + 1];
        }

        if (!truncate) {
          throw new Error("Seq has not enough elements");
        }
      }

      return undefined;
    }, 0);
  });
}

function truncate(n, xs) {
  return take(n, xs, true);
}

function takeWhile(f, xs) {
  return delay(() => {
    const iter = xs[Symbol.iterator]();
    return unfold(() => {
      const cur = iter.next();

      if (!cur.done && f(cur.value)) {
        return [cur.value, undefined];
      }

      return undefined;
    }, 0);
  });
}

function tryFind(f, xs, defaultValue) {
  for (let i = 0, iter = xs[Symbol.iterator]();; i++) {
    const cur = iter.next();

    if (cur.done) {
      break;
    }

    if (f(cur.value, i)) {
      return (0, _Option.some)(cur.value);
    }
  }

  return defaultValue === void 0 ? undefined : (0, _Option.some)(defaultValue);
}

function find(f, xs) {
  return __failIfNone(tryFind(f, xs));
}

function tryFindBack(f, xs, defaultValue) {
  const arr = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs.slice(0) : Array.from(xs);
  return tryFind(f, arr.reverse(), defaultValue);
}

function findBack(f, xs) {
  return __failIfNone(tryFindBack(f, xs));
}

function tryFindIndex(f, xs) {
  for (let i = 0, iter = xs[Symbol.iterator]();; i++) {
    const cur = iter.next();

    if (cur.done) {
      break;
    }

    if (f(cur.value, i)) {
      return i;
    }
  }

  return undefined;
}

function findIndex(f, xs) {
  return __failIfNone(tryFindIndex(f, xs));
}

function tryFindIndexBack(f, xs) {
  const arr = Array.isArray(xs) || ArrayBuffer.isView(xs) ? xs.slice(0) : Array.from(xs);

  for (let i = arr.length - 1; i >= 0; i--) {
    if (f(arr[i], i)) {
      return i;
    }
  }

  return undefined;
}

function findIndexBack(f, xs) {
  return __failIfNone(tryFindIndexBack(f, xs));
}

function tryPick(f, xs) {
  for (let i = 0, iter = xs[Symbol.iterator]();; i++) {
    const cur = iter.next();

    if (cur.done) {
      break;
    }

    const y = f(cur.value, i);

    if (y != null) {
      return y;
    }
  }

  return undefined;
}

function pick(f, xs) {
  return __failIfNone(tryPick(f, xs));
}

function unfold(f, fst) {
  return makeSeq(() => {
    // Capture a copy of the first value in the closure
    // so the sequence is restarted every time, see #1230
    let acc = fst;
    const iter = {
      next() {
        const res = f(acc);

        if (res != null) {
          const v = (0, _Option.value)(res);

          if (v != null) {
            acc = v[1];
            return {
              done: false,
              value: v[0]
            };
          }
        }

        return {
          done: true,
          value: undefined
        };
      }

    };
    return iter;
  });
}

function zip(xs, ys) {
  return map2((x, y) => [x, y], xs, ys);
}

function zip3(xs, ys, zs) {
  return map3((x, y, z) => [x, y, z], xs, ys, zs);
}

function windowed(windowSize, source) {
  if (windowSize <= 0) {
    throw new Error("windowSize must be positive");
  }

  return makeSeq(() => {
    let window = [];
    const iter = source[Symbol.iterator]();
    const iter2 = {
      next() {
        let cur;

        while (window.length < windowSize) {
          if ((cur = iter.next()).done) {
            return {
              done: true,
              value: undefined
            };
          }

          window.push(cur.value);
        }

        const value = window;
        window = window.slice(1);
        return {
          done: false,
          value
        };
      }

    };
    return iter2;
  });
}

function transpose(source) {
  return makeSeq(() => {
    const iters = Array.from(source, x => x[Symbol.iterator]());
    const iter = {
      next() {
        if (iters.length === 0) {
          return {
            done: true,
            value: undefined
          }; // empty sequence
        }

        const results = Array.from(iters, iter => iter.next());

        if (results[0].done) {
          if (!results.every(x => x.done)) {
            throw new Error("Sequences have different lengths");
          }

          return {
            done: true,
            value: undefined
          };
        } else {
          if (!results.every(x => !x.done)) {
            throw new Error("Sequences have different lengths");
          }

          const values = results.map(x => x.value);
          return {
            done: false,
            value: values
          };
        }
      }

    };
    return iter;
  });
}