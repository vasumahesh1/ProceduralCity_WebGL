#version 300 es

#define MAX_INSTANCES 200

/*----------  Shader Uniforms  ----------*/
uniform mat4 u_Model;
uniform mat4 u_ModelInvTr;
uniform mat4 u_ViewProj;
uniform mat4 u_LightSpaceMatrix;
uniform mat4 u_GlobalTransform;
uniform int u_Time;
uniform vec3 u_LightPos;
uniform vec4 u_Eye;

/*----------  Shader UI Controls  ----------*/
uniform vec3 u_ControlsWaterBedrock1Color;
uniform vec3 u_ControlsWaterBedrock2Color;
uniform vec3 u_ControlsSandColor;
uniform float u_ControlsWaterLevel;
uniform float u_ControlsShoreLevel;
uniform float u_ControlsElevation;
uniform float u_ControlsNoiseScale;

/*----------  Shader Inputs  ----------*/
in vec4 vs_Pos;
in vec4 vs_Nor;
in vec4 vs_Col;
in vec2 vs_UV;
in vec4 vs_InstPos;
in vec4 vs_InstScale;
in vec4 vs_InstRotation;

/*----------  Shader Outputs  ----------*/
out vec4 fs_Nor;
out vec4 fs_LightVec;
out vec4 fs_Col;
out vec4 fs_Pos;
out vec2 fs_UV;

vec4 quatConjugate(vec4 q)
{ 
  return vec4(-q.x, -q.y, -q.z, q.w); 
}

vec4 quatMultiply(vec4 q1, vec4 q2)
{ 
  vec4 qr;
  qr.x = (q1.w * q2.x) + (q1.x * q2.w) + (q1.y * q2.z) - (q1.z * q2.y);
  qr.y = (q1.w * q2.y) - (q1.x * q2.z) + (q1.y * q2.w) + (q1.z * q2.x);
  qr.z = (q1.w * q2.z) + (q1.x * q2.y) - (q1.y * q2.x) + (q1.z * q2.w);
  qr.w = (q1.w * q2.w) - (q1.x * q2.x) - (q1.y * q2.y) - (q1.z * q2.z);
  return qr;
}

vec4 rotateByQuat(vec4 position, vec4 quat)
{ 
  vec4 quatConj = quatConjugate(quat);
  vec4 quatPos = vec4(position.x, position.y, position.z, 0);
  
  vec4 quatTemp = quatMultiply(quat, quatPos);
  quatTemp = quatMultiply(quatTemp, quatConj);
  
  return vec4(quatTemp.x, quatTemp.y, quatTemp.z, 0);
}

void main() {
  vec4 vertexColor;
  vec4 vertexPosition = vs_Pos;
  vec4 vertexNormal = vs_Nor;
  vec4 vertexScale = vs_InstScale;

  fs_Col = vec4(64,21,15, 255) / 255.0;

  vertexNormal = vertexNormal * vec4(1.0 / vertexScale.x, 1.0 / vertexScale.y, 1.0 / vertexScale.z, 0.0);
  vertexNormal = rotateByQuat(vertexNormal, vs_InstRotation);

  // mat3 invTranspose = inverse(mat3(instanceModel));
  fs_Nor = normalize(vertexNormal); // vec4(invTranspose * vec3(vertexNormal), 0);

  vec4 modelposition = u_Model * vertexPosition;
  modelposition = vertexScale * vertexPosition;
  modelposition = rotateByQuat(modelposition, vs_InstRotation);
  modelposition += vs_InstPos;

  fs_Pos = modelposition;

  fs_UV = vs_UV;

  fs_LightVec = vec4(u_LightPos, 0) - modelposition;

  gl_Position = u_ViewProj * modelposition;
}
