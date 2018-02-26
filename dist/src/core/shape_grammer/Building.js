class Building {
    constructor() {
    }
    render(shader, camera, renderer) {
        renderer.render(camera, shader, [this.instance]);
    }
}
export default Building;
//# sourceMappingURL=Building.js.map