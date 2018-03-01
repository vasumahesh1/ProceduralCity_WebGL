let Noise = require('noisejs').Noise;

var vec2 = require('gl-matrix').vec2;

let noise = new Noise(3478);

var fs = require('fs');


function fbm2D(point, octaves){
  let s = 0.0;
  let m = 0.0;
  let a = 0.5;

  let p = vec2.create();
  vec2.copy(p, point);
  
  for(let i = 0; i < octaves;  i++) {
    s += a * noise.simplex2(p[0], p[1]);
    m += a;
    a *= 0.5;
    vec2.scale(p, p, 2.0);
  }

  return s / m;
}

function generatePositiveNoise(seed) {
  noise = new Noise(seed);

  let data = [];

  for (var i = 0; i < 700; i++) {
    let row = [];
    for (var j = 0; j < 700; j++) {
      row.push(fbm2D(vec2.fromValues(i, j), 8));
    }

    data.push(row);
  }

  return data;
}

function generateSimplex2D(seed) {
  noise = new Noise(seed);

  let data = [];

  for (var i = 0; i < 200; i++) {
    let row = [];
    for (var j = 0; j < 200; j++) {
      row.push(noise.simplex2(i / 100, j / 100));
    }

    data.push(row);
  }

  return data;
}

let exportData = {
  positive_noise_1: {
    sizeX: 700,
    sizeY: 700,
    values: generatePositiveNoise(1259)
  },
  simplex2d: {
    sizeX: 200,
    sizeY: 200,
    values: generateSimplex2D(677)
  }
};

let str = JSON.stringify(exportData);


fs.writeFile('./noise.json', str, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
}); 