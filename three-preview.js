import * as THREE from "./vendor/three/build/three.module.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";

export class ThreePreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1621);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    const aspect =
      canvas.clientWidth > 0 && canvas.clientHeight > 0
        ? canvas.clientWidth / canvas.clientHeight
        : 1;
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
    this.camera.position.set(0, -80, 60);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.6;
    this.controls.target.set(0, 0, 0.6);
    this.controls.update();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
    keyLight.position.set(40, -30, 60);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-40, 30, 40);
    this.scene.add(fillLight);

    this.plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.1,
      roughness: 0.8,
    });
    this.textMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.4,
    });

    this.plateMesh = null;
    this.textMesh = null;

    window.addEventListener("resize", () => this.handleResize());
    this.handleResize();
    this.start();
  }

  handleResize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement.offsetWidth;
    const height = this.canvas.clientHeight || this.canvas.parentElement.offsetHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  }

  updateMaterials({ plateColor, textColor }) {
    if (plateColor) {
      this.plateMaterial.color.setRGB(
        plateColor[0] / 255,
        plateColor[1] / 255,
        plateColor[2] / 255
      );
    }
    if (textColor) {
      this.textMaterial.color.setRGB(
        textColor[0] / 255,
        textColor[1] / 255,
        textColor[2] / 255
      );
    }
  }

  setPlateGeometry(geometry) {
    if (this.plateMesh) {
      this.scene.remove(this.plateMesh);
      this.plateMesh.geometry.dispose();
    }
    if (!geometry) {
      this.plateMesh = null;
      return;
    }
    this.plateMesh = new THREE.Mesh(geometry, this.plateMaterial);
    this.scene.add(this.plateMesh);
    this.render();
  }

  setTextGeometry(geometry) {
    if (this.textMesh) {
      this.scene.remove(this.textMesh);
      this.textMesh.geometry.dispose();
    }
    if (!geometry) {
      this.textMesh = null;
      return;
    }
    this.textMesh = new THREE.Mesh(geometry, this.textMaterial);
    this.scene.add(this.textMesh);
    this.render();
  }

  start() {
    const tick = () => {
      this.controls.update();
      this.render();
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
