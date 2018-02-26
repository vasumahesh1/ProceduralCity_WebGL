#version 300 es

#define MAX_INSTANCES 200

/*----------  Shader Uniforms  ----------*/
uniform mat4 u_Model;
uniform mat4 u_ModelInvTr;
uniform mat4 u_ViewProj;
uniform int u_Time;
uniform vec4 u_Eye;
uniform vec3 u_LightPos;
uniform mat4 u_LightSpaceMatrix;
uniform mat4 u_LightViewportMatrix;

uniform mat4 u_InstanceModel[MAX_INSTANCES];

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
in vec4 vs_InstPos;

/*----------  Shader Outputs  ----------*/
out vec4 fs_Nor;
out vec4 fs_LightVec;
out vec4 fs_Col;
out vec4 fs_Pos;
out vec4 fs_SphereNor;
out vec4 fs_ShadowCoord;
out float fs_Spec;
out float fs_Valid;
out float fs_useMatcap;



void main() {
  vec4 vertexColor;
  vec4 vertexPosition = vs_Pos;
  vec4 vertexNormal = vs_Nor;
  mat4 instanceModel = u_InstanceModel[gl_InstanceID];

  fs_Col = vs_Col;

  mat3 invTranspose = inverse(mat3(instanceModel));
  fs_Nor = vec4(invTranspose * vec3(vertexNormal), 0);

  vec4 modelposition = instanceModel * u_Model * vertexPosition;

  fs_Pos = modelposition;

  fs_ShadowCoord = u_LightViewportMatrix * modelposition;

  fs_LightVec = vec4(u_LightPos, 0) - modelposition;

  gl_Position = u_ViewProj * modelposition;
}
