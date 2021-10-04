module.export({
  eachline: () => eachline,
  transform: () => transform
});
let Transform;
module.link("stream", {
  Transform(v) {
    Transform = v;
  }

}, 0);

const split = require("split2");

const pipe = require("multipipe");

function eachline(stream, callback) {
  stream.pipe(transform(callback));
}

function transform(callback) {
  const splitStream = split(/\r?\n/, null, {
    trailing: false
  });
  const transform = new Transform();

  transform._transform = function (chunk, _encoding, done) {
    return Promise.asyncApply(() => {
      let line = chunk.toString("utf8");

      try {
        line = Promise.await(callback(line));
      } catch (error) {
        done(error);
        return;
      }

      done(null, line);
    });
  };

  return pipe(splitStream, transform);
}
//# sourceMappingURL=eachline.js.map