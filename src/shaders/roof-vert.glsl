#version 300 es

#define MAX_INSTANCES 200

/*----------  Shader Uniforms  ----------*/
uniform mat4 u_Model;
uniform mat4 u_ModelInvTr;
uniform mat4 u_ViewProj;
uniform mat4 u_LightSpaceMatrix;
uniform int u_Time;
uniform vec3 u_LightPos;
uniform vec4 u_Eye;

/*----------  Shader Inputs  ----------*/
in vec4 vs_Pos;
in vec4 vs_Nor;
in vec4 vs_Col;
in vec2 vs_UV;

/*----------  Shader Outputs  ----------*/
out vec4 fs_Nor;
out vec4 fs_LightVec;
out vec4 fs_Col;
out vec4 fs_Pos;
out vec4 fs_SphereNor;
out float fs_Spec;
out float fs_Valid;
out float fs_useMatcap;
out vec2 fs_UV;

void main() {
  vec4 vertexColor;
  vec4 vertexPosition = vs_Pos;
  vec4 vertexNormal = vs_Nor;
  // mat4 instanceModel = u_InstanceModel[gl_InstanceID];

  mat3 invTranspose = transpose(inverse(mat3(u_Model)));
  fs_Nor = normalize(vertexNormal); // vec4(invTranspose * vec3(vertexNormal), 0);

  vec4 modelposition = u_Model * vertexPosition;

  fs_Pos = modelposition;

  fs_Col = vec4(64,21,15, 255) / 255.0;

  fs_UV = vs_UV;

  fs_LightVec = vec4(u_LightPos, 0) - modelposition;

  gl_Position = u_ViewProj * modelposition;
}
