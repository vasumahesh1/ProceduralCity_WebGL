# ProceduralCity_WebGL

![](images/screen_4.png)

## Important Node

Please run this on Windows. There seems to be a glitch in my mac with this code. All screenshots here are on a windows pc.

My focus on this project was purely on configuration that enables me to draw different buildings with minimal effort. Sadly, couldn't spend much time making it pretty. I have some small stuffs like a distance fog, some textures on windows and roofs but thats pretty much it.

[Demo Link](https://vasumahesh1.github.io/ProceduralCity_WebGL/)g

## Grammar Design

### Building Blueprints

Inorder to have a balance between lsystem shape grammar and some noise, I decided that the turtle will be responsible for drawing how a Lot will look like. Instead of relying purely on shapes like Cubes, The turtle is capable of drawing `LotSides` which are just lines. This enables me to programmatically also generate lines like a circle, hexagon etc. And not just rely on objs.

So the Grammar starts when a Property is allocated in the region based on Noise. Each Property gets a JSON based Configuration that details how this property will look like. An example would be selecting the Windows for the Building.

You can think of this as a Theme for the Building which will be created.

Here is a Full Building Blueprint
```json
{
  "name": "Building Blueprint 1",
  "selectionWeight": 100,
  "windows": {
    "rng": {
      "seed": 17,
      "type": "WeightedRNG",
      "val": {
        "WindowComponent1": 10,
        "WindowComponent2": 10
      }
    }
  },
  "walls": [{
    "rng": {
      "seed": 123,
      "type": "WeightedRNG",
      "val": {
        "WallComponent1": 10,
        "WallComponent2": 10,
        "WallComponent3": 10,
        "WallComponent4": 10
      }
    },
    "default": true
  }],
  "roofs": {
    "rng": {
      "seed": 17,
      "type": "WeightedRNG",
      "val": {
        "RoofComponent1": 10,
        "RoofComponent2": 50
      }
    }
  },
  "iteration": {
    "rng": {
      "seed": 39,
      "type": "RNG",
      "min": 2,
      "max": 4
    }
  },
  "floors": {
    "rng": {
      "seed": 3,
      "type": "RNG",
      "min": 12,
      "max": 25
    },
    "type": {
      "rng": {
        "seed": 123,
        "type": "WeightedRNG",
        "val": {
          "RANDOM_ACROSS_LOTS": 2
        }
      }
    },
    "height": {
      "rng": {
        "seed": 213,
        "type": "RNG",
        "min": 3,
        "max": 6
      }
    },
    "separator": {
      "rng": {
        "seed": 432,
        "type": "WeightedRNG",
        "val": {
          "RANDOM_ACROSS_LOTS": 2,
          "RANDOM_ACROSS_FLOORS": 0,
          "FIXED": 100
        }
      },
      "placement": {
        "rng": {
          "seed": 2134,
          "type": "WeightedRNG",
          "val": {
            "CAN_PLACE": 100,
            "CANNOT_PLACE": 0
          }
        }
      },
      "obj": {
        "rng": {
          "seed": 124,
          "type": "WeightedRNG",
          "val": {
            "SepComponent1": 10
          }
        }
      }
    }
  },
  "constraints": {
    "population": 0.6
  }
}
``` 

I have defined some class structures which cover the random "rng" keyword in the json. Before loading the city, This json is read and the blueprints are initialized.

There are a lot of things to change and are mostly readable.


### Components

Now the `Components` you see are the base building blocks of my procedural city.

A Component Configuration Looks like:

```json
{
  "name": "WallComponent1",
  "url": "./src/objs/comp_wall.obj",
  "width": 1,
  "type": "wall",
  "baseScale": [1, 3, 1],
  "uvOffset": [0,0]
}
```

I have textures enabled for windows roofs etc. But I havent textured them in photoshop. They just have a matte color for now (except windows & roofs).

### Lots

LSystems have capability to draw lots with different shapes, combine them and from these lots I "pull out" buildings.

Lots can be **FIXED** or **DYNAMIC**.

Fixed Lots look like:

```json
{
  "name": "Square",
  "type": "FIXED",
  "sides": [{
    "start": [0, 0],
    "end": [1, 0]
  }, {
    "start": [1, 0],
    "end": [1, 1]
  }, {
    "start": [1, 1],
    "end": [0, 1]
  }, {
    "start": [0, 1],
    "end": [0, 0]
  }]
}
```


Dynamic Lots look like:

```json
{
  "name": "Circle",
  "type": "DYNAMIC",
  "controller": "PolygonLotConstructor",
  "options": {
    "startAngle": 0,
    "endAngle": 360,
    "subDivs": 16,
    "radius": 0.5,
    "offset": [0.5, 0.5]
  }
}
```

Notice the use of `controller` that invokes a JS Function to get the `LotSides` dynamically for each lot.

Dynamic Lots are, you _guessed it_ dynamically roofed by just a simple triangulation over them.

### Noise cache & Population Noise

I cached some of the noise into const variables that later gets injected by webpack. It helps in saving generation time. I use noise on a lot things, they control almost everything related to construction.

Population based noise to change building heights is also included. I haven't had much time to play with it, Since I was working mostly on building creation.

### Windows

My Building have windows that are separtely modeled. They are used in a very different LSystem like config that varies per building and per side.

It works by generating a string for its Layout. For example a layout can be `*W*W*W*` which means that `LotSide` where these windows are to be placed, will construct three equally spaced Windows.

Another way to extend different window combinations. These are also present in Building Blueprint JSON. Also, If the string exceeds the actual length available then the algorithm tries to best fit the windows that it can stuff in that `LotSide`.

### Building Collision

I have a simple collider check for each `Property` that gets allocated.

### LSystem 2.0

I modded the hell out of my LSystem. It includes some really great features which allow me to check for constraints, rule production based params, function params. Here is a small snippet that will showcase it:

```js
// {} Indicates Parameter Passing as a CSV (comma separated value) to my Production Rules

this.system.addRule("Q", "bF{1}+Q");
this.system.addRule("W", "F{1.0}b{0.5}F{1.0}-W");

// F{1} means we move Forward in the Heading Direction of the Turtle by 1 magnitude.
// b{0.5} means draw a square lot with 0.5 scale.
// You can see how One can further make this awesome by adding some randomness
// or some constraints that change these rule definitions on the fly!

// Resuse a Production Rule
I was tired of making functions for drawing different Lots. So I use:
this.system.addSymbol('z', drawShape, ['Circle']);
this.system.addSymbol('x', drawShape, ['TiltedSquare']);
this.system.addSymbol('c', drawShape, ['Hex']);


// Same Function, A new param and for each symbol.

// Use it as:
function drawShape(shape: string) {
```

The lots on which the LSystem operates is of Size 2x2 only. They get later scaled in the relative Property size. The rules are also ensured in such a way that the turtle never exceeds the boundary condition.


### Grammar Productions

#### Pattern Rules

These rules are dedicated to select a pattern.

```js
// Pattern Rules
this.system.addWeightedRule("P", "Q", 100);
this.system.addWeightedRule("P", "F{0.5}+F{0.5}bW", 100);
this.system.addWeightedRule("P", "E", 100);
this.system.addWeightedRule("P", "F{0.5}+F{0.5}bR", 100);
this.system.addWeightedRule("P", "F{0.5}+F{0.5}bT", 100);
this.system.addWeightedRule("P", "Y", 100);
this.system.addWeightedRule("P", "U", 100);
this.system.addWeightedRule("P", "I", 100);
this.system.addWeightedRule("P", "F{0.5}+F{0.5}zA", 100);
this.system.addWeightedRule("P", "D", 100);
```

#### Growing Rules

These rules are dedicated to grow on the pattern.

```js
this.system.addRule("Q", "bF{1}+Q");
this.system.addRule("W", "F{1.0}b{0.5}F{1.0}-W");
this.system.addRule("E", "[F{0.2}+F{0.2}b{0.75}]F{1.75}+E");

this.system.addRule("R", "F{1.0}^{0.5}b{0.5}F{1.0}-R");
this.system.addRule("T", "F{1.0}[^{0.5}b{0.5}]F{1.0}-T");
this.system.addRule("Y", "S{1}oF{-2}+F{-2}x{-1}");
this.system.addRule("U", "S{1}oF{-2}+F{-2}o{-1}");

this.system.addRule("I", "zF{1}+I");
this.system.addRule("A", "F{1.0}z{0.5}F{1.0}-A");
this.system.addRule("D", "[F{0.2}+F{0.2}z{0.75}]F{1.75}+D");

this.system.addRule("G", "cF{1}+G");
this.system.addRule("H", "F{1.0}c{0.5}F{1.0}-H");
this.system.addRule("J", "[F{0.2}+F{0.2}c{0.75}]F{1.75}+J");

// Functions pretty much explain what they do.
this.system.addSymbol('b', drawSquareLot, []);
this.system.addSymbol('o', drawHalfCircleLot, []);
this.system.addSymbol('z', drawShape, ['Circle']);
this.system.addSymbol('x', drawShape, ['TiltedSquare']);
this.system.addSymbol('c', drawShape, ['Hex']);

this.system.addSymbol('+', rotateCCW90, []);
this.system.addSymbol('-', rotateCW90, []);

this.system.addSymbol('*', rotateCCWAngle, []);
this.system.addSymbol('/', rotateCWAngle, []);

this.system.addSymbol('^', moveUp, []);
this.system.addSymbol('v', moveDown, []);

this.system.addSymbol('F', moveForward, []);
this.system.addSymbol('V', moveVector, []);

this.system.addSymbol('S', setSameSize, []);
```


### Asset Loader

I made a simple asset loader using AsyncJS and Promises. Not that it is a part of the assignment, but worth mentioning as it simplified my asset imports (by combining it with Components).

```js
let assets:any = {};
assets.testMesh = './src/bjs/testMesh.obj';

assetLibrary.load(assets)
    .then(function() {
      assetLibrary.meshes['testMesh'] // Mesh
    })
``` 

Future upgrade might include importing Textures.

### Different Possible Buildings

This isn't an exhaustive set, due to the randomness of my LSystem & Building construction. But some the images generated by the default noise & seed.


![](images/screen_1.png)
![](images/screen_2.png)
![](images/screen_3.png)
![](images/screen_4.png)
![](images/screen_5.png)
![](images/screen_6.png)
![](images/screen_7.png)
![](images/screen_8.png)
![](images/screen_9.png)
![](images/screen_10.png)
![](images/screen_11.png)
![](images/screen_12.png)
![](images/screen_13.png)
![](images/screen_14.png)
![](images/screen_15.png)
![](images/screen_16.png)
![](images/screen_17.png)
