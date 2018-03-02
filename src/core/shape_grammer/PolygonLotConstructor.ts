import { vec2, vec3, vec4, mat4, glMatrix } from 'gl-matrix';

function degreeToRad(deg: number) {
  return deg * 0.0174533;
}

class PolygonLotConstructor {
  

  constructor() {

  }

  getSides(options: any) {
    let startAngle = options.startAngle || 0;
    let endAngle = options.endAngle || 360;
    let subDivs = options.subDivs || 8;
    let radius = options.radius || 1.0;

    let offset = options.offset || [1.0, 1.0];

    let prevPoint = [radius * Math.cos(degreeToRad(startAngle)) + offset[0], radius * Math.sin(degreeToRad(startAngle)) + offset[1]];

    let angleStep = (endAngle - startAngle) / subDivs;

    let sides = [];

    for (var angle = startAngle + angleStep; angle <= endAngle; angle += angleStep) {
      let point = [radius * Math.cos(degreeToRad(angle)) + offset[0], radius * Math.sin(degreeToRad(angle)) + offset[1]];

      let obj:any = {};
      obj.start = prevPoint;
      obj.end = point;

      sides.push(obj);

      prevPoint = point;
    }

    return sides;
  }

}

export default PolygonLotConstructor;