/* all preset probability functions go here with export modifier*/

export function testFunction(){
    return "test succesful";
}

export function mul(m1, m2) {
    var result = 0;
          var len = m1.length;
          for (var i = 0; i < len; i++) {
              result += m1[i] * m2[i]
          }
          return result
        }

export function logitdec(outcomes, decay) {
    if (outcomes) {
    var outcomessuc = JSON.parse(JSON.stringify(outcomes));
    var outcomesfail = outcomes.map(function(value) {
        return Math.abs(value - 1)
    });
    var w = outcomessuc.unshift(1);
    var v = outcomesfail.unshift(1);
    return Math.log(mul(outcomessuc, [...Array(w).keys()].reverse().map(function(value, index) {
        return Math.pow(decay, value)
    })) / mul(outcomesfail, [...Array(w).keys()].reverse().map(function(value, index) {
        return Math.pow(decay, value)
    })))
    }
    return 0
}

export function recency(age, d) {
    if (age==0) { return 0;
    } else
    {return Math.pow(1 + age, -d);
    }
}

export function quaddiffcor(seq, probs) {
return mul(seq, probs.map(function(value) {
  return value * value
}))
}


export function quaddiffincor(seq, probs) {
return mul(Math.abs(seq-1), probs.map(function(value) {
  return value * value
}))
}

export function linediffcor(seq, probs) {
return mul(seq, probs)
}

export function linediffincor(seq, probs) {
return mul(seq.map(function(value) {
  return Math.abs(value - 1)
}), probs)
}
                     
export function arrSum(arr){return arr.reduce(function(a,b){return a + b}, 0)}
export function errlist(seq) {  return seq.map(function(value) {return Math.abs(value - 1)})}