import * as THREE from 'three';
import { Vec3, vec3Sub, vec3Dot } from '../fem/matrix';
import { Node3D } from '../fem/types';

export interface Camera3D {
  azimuth: number; // horizontal angle in degrees (around Z axis)
  elevation: number; // vertical angle in degrees (-90 to +90)
  scale: number; // pixels per model unit (meter)
  panX: number; // screen pan offset X
  panY: number; // screen pan offset Y
  target: Vec3; // look-at center point [X, Y, Z]
}

export interface ScreenPoint3D {
  x: number;
  y: number;
  depth: number; // distance along camera forward vector
  visible: boolean;
}

export type ViewCubeHit =
  // 6 Primary Faces
  | 'TOP'
  | 'BOTTOM'
  | 'FRONT'
  | 'BACK'
  | 'LEFT'
  | 'RIGHT'
  // 8 Isometric Corners
  | 'ISO_SW'      // Top-Front-Left
  | 'ISO_SE'      // Top-Front-Right
  | 'ISO_NE'      // Top-Back-Right
  | 'ISO_NW'      // Top-Back-Left
  | 'ISO_SW_BOT'  // Bottom-Front-Left
  | 'ISO_SE_BOT'  // Bottom-Front-Right
  | 'ISO_NE_BOT'  // Bottom-Back-Right
  | 'ISO_NW_BOT'  // Bottom-Back-Left
  // 8 Edges
  | 'EDGE_TF'     // Top-Front
  | 'EDGE_TB'     // Top-Back
  | 'EDGE_TL'     // Top-Left
  | 'EDGE_TR'     // Top-Right
  | 'EDGE_FL'     // Front-Left
  | 'EDGE_FR'     // Front-Right
  | 'EDGE_BL'     // Back-Left
  | 'EDGE_BR'     // Back-Right
  // Compass Cardinals
  | 'COMPASS_N'
  | 'COMPASS_S'
  | 'COMPASS_E'
  | 'COMPASS_W'
  // Navigation Controls
  | 'ROLL_CCW'
  | 'ROLL_CW'
  | 'HOME'
  | 'FIT';

export class RenderEngine3D {
  public camera: Camera3D = {
    azimuth: -45,
    elevation: 30,
    scale: 60,
    panX: 0,
    panY: 0,
    target: [0, 0, 0],
  };

  public width = 800;
  public height = 600;
  public dpr = 1;

  // Three.js Core
  public renderer: THREE.WebGLRenderer | null = null;
  public scene: THREE.Scene;
  public threeCamera: THREE.OrthographicCamera;
  public modelGroup: THREE.Group;
  public overlayGroup: THREE.Group;

  // ViewCube parameters
  public cubeSize = 84;
  public cubeMargin = 20;

  constructor() {
    this.scene = new THREE.Scene();
    this.modelGroup = new THREE.Group();
    this.overlayGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
    this.scene.add(this.overlayGroup);

    // Setup Orthographic Camera
    this.threeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    this.scene.add(this.threeCamera);

    // Lighting setup for realistic 3D shading
    const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(10, -20, 30);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-10, 20, -10);
    this.scene.add(dirLight2);
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    if (this.renderer) {
      if (this.renderer.domElement === canvas) return;
      this.renderer.dispose();
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
  }

  public setSize(w: number, h: number, dpr = 1) {
    if (this.width > 0 && this.height > 0 && (this.width !== w || this.height !== h)) {
      if (this.camera.panX !== 0 || this.camera.panY !== 0) {
        this.camera.panX = (this.camera.panX / this.width) * w;
        this.camera.panY = (this.camera.panY / this.height) * h;
      }
    }
    this.width = w;
    this.height = h;
    this.dpr = dpr;

    if (this.camera.panX === 0 && this.camera.panY === 0) {
      this.camera.panX = w / 2;
      this.camera.panY = h / 2;
    }

    if (this.renderer) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
    }

    this.updateThreeCamera();
  }

  public getForwardVector(): Vec3 {
    const azRad = (this.camera.azimuth * Math.PI) / 180;
    const elRad = (this.camera.elevation * Math.PI) / 180;

    const cosEl = Math.cos(elRad);
    const sinEl = Math.sin(elRad);
    const cosAz = Math.cos(azRad);
    const sinAz = Math.sin(azRad);

    return [-cosEl * sinAz, cosEl * cosAz, -sinEl];
  }

  public getCameraBasis(): { right: Vec3; up: Vec3; forward: Vec3 } {
    const azRad = (this.camera.azimuth * Math.PI) / 180;
    const elRad = (this.camera.elevation * Math.PI) / 180;

    const cosEl = Math.cos(elRad);
    const sinEl = Math.sin(elRad);
    const cosAz = Math.cos(azRad);
    const sinAz = Math.sin(azRad);

    const forward: Vec3 = [-cosEl * sinAz, cosEl * cosAz, -sinEl];
    const right: Vec3 = [cosAz, sinAz, 0];
    const up: Vec3 = [-sinAz * sinEl, cosAz * sinEl, cosEl];

    return { right, up, forward };
  }

  public setRotationCenter(target3D: Vec3) {
    const oldScreenPos = this.project(target3D);
    this.camera.target = [target3D[0], target3D[1], target3D[2]];
    this.camera.panX = oldScreenPos.x;
    this.camera.panY = oldScreenPos.y;
    this.updateThreeCamera();
  }

  public updateThreeCamera() {
    const { right, up, forward } = this.getCameraBasis();
    const target = this.camera.target;
    const dist = 500; // Far enough distance for orthographic camera

    const camPos: Vec3 = [
      target[0] - forward[0] * dist,
      target[1] - forward[1] * dist,
      target[2] - forward[2] * dist,
    ];

    this.threeCamera.position.set(camPos[0], camPos[1], camPos[2]);
    this.threeCamera.up.set(up[0], up[1], up[2]);
    this.threeCamera.lookAt(target[0], target[1], target[2]);

    const scale = Math.max(1, this.camera.scale);
    const left = -this.camera.panX / scale;
    const rightVal = (this.width - this.camera.panX) / scale;
    const top = this.camera.panY / scale;
    const bottom = -(this.height - this.camera.panY) / scale;

    this.threeCamera.left = left;
    this.threeCamera.right = rightVal;
    this.threeCamera.top = top;
    this.threeCamera.bottom = bottom;
    this.threeCamera.near = -2000;
    this.threeCamera.far = 2000;
    this.threeCamera.updateProjectionMatrix();
  }

  public project(p: Vec3): ScreenPoint3D {
    const { right, up, forward } = this.getCameraBasis();
    const rel = vec3Sub(p, this.camera.target);

    const xCam = vec3Dot(rel, right);
    const yCam = vec3Dot(rel, up);
    const depth = vec3Dot(rel, forward);

    const screenX = this.camera.panX + xCam * this.camera.scale;
    const screenY = this.camera.panY - yCam * this.camera.scale;

    return {
      x: screenX,
      y: screenY,
      depth,
      visible: true,
    };
  }

  public unprojectToXYPlane(screenX: number, screenY: number, zLevel = 0): Vec3 {
    const { right, up, forward } = this.getCameraBasis();
    const xCam = (screenX - this.camera.panX) / this.camera.scale;
    const yCam = -(screenY - this.camera.panY) / this.camera.scale;

    const pCam: Vec3 = [
      this.camera.target[0] + xCam * right[0] + yCam * up[0],
      this.camera.target[1] + xCam * right[1] + yCam * up[1],
      this.camera.target[2] + xCam * right[2] + yCam * up[2],
    ];

    if (Math.abs(forward[2]) < 1e-4) {
      return [pCam[0], pCam[1], zLevel];
    }

    const t = (zLevel - pCam[2]) / forward[2];
    return [pCam[0] + t * forward[0], pCam[1] + t * forward[1], zLevel];
  }

  public unprojectToXZPlane(screenX: number, screenY: number, yLevel = 0): Vec3 {
    const { right, up, forward } = this.getCameraBasis();
    const xCam = (screenX - this.camera.panX) / this.camera.scale;
    const yCam = -(screenY - this.camera.panY) / this.camera.scale;

    const pCam: Vec3 = [
      this.camera.target[0] + xCam * right[0] + yCam * up[0],
      this.camera.target[1] + xCam * right[1] + yCam * up[1],
      this.camera.target[2] + xCam * right[2] + yCam * up[2],
    ];

    if (Math.abs(forward[1]) < 1e-4) {
      return [pCam[0], yLevel, pCam[2]];
    }

    const t = (yLevel - pCam[1]) / forward[1];
    return [pCam[0] + t * forward[0], yLevel, pCam[2] + t * forward[2]];
  }

  public unprojectToYZPlane(screenX: number, screenY: number, xLevel = 0): Vec3 {
    const { right, up, forward } = this.getCameraBasis();
    const xCam = (screenX - this.camera.panX) / this.camera.scale;
    const yCam = -(screenY - this.camera.panY) / this.camera.scale;

    const pCam: Vec3 = [
      this.camera.target[0] + xCam * right[0] + yCam * up[0],
      this.camera.target[1] + xCam * right[1] + yCam * up[1],
      this.camera.target[2] + xCam * right[2] + yCam * up[2],
    ];

    if (Math.abs(forward[0]) < 1e-4) {
      return [xLevel, pCam[1], pCam[2]];
    }

    const t = (xLevel - pCam[0]) / forward[0];
    return [xLevel, pCam[1] + t * forward[1], pCam[2] + t * forward[2]];
  }

  public unprojectToPlane(screenX: number, screenY: number, plane: 'XY' | 'XZ' | 'YZ', planeOffset = 0): Vec3 {
    if (plane === 'XZ') return this.unprojectToXZPlane(screenX, screenY, planeOffset);
    if (plane === 'YZ') return this.unprojectToYZPlane(screenX, screenY, planeOffset);
    return this.unprojectToXYPlane(screenX, screenY, planeOffset);
  }

  public unprojectToZPlane(screenX: number, screenY: number, zLevel = 0): Vec3 {
    return this.unprojectToXYPlane(screenX, screenY, zLevel);
  }

  public fitView(nodes: Node3D[], margin = 80) {
    if (nodes.length === 0) {
      this.camera.target = [0, 0, 0];
      this.camera.scale = 60;
      this.camera.panX = this.width / 2;
      this.camera.panY = this.height / 2;
      this.updateThreeCamera();
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
      minZ = Math.min(minZ, n.z);
      maxZ = Math.max(maxZ, n.z);
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    this.camera.target = [cx, cy, cz];

    const spanX = Math.max(maxX - minX, 1.0);
    const spanY = Math.max(maxY - minY, 1.0);
    const spanZ = Math.max(maxZ - minZ, 1.0);
    const diag = Math.hypot(spanX, spanY, spanZ) || 4;

    const availW = Math.max(this.width - 2 * margin, 200);
    const availH = Math.max(this.height - 2 * margin, 200);

    const targetScale = Math.min(availW, availH) / (diag * 1.15);
    this.camera.scale = Math.max(4, Math.min(targetScale, 300));
    this.camera.panX = this.width / 2;
    this.camera.panY = this.height / 2;

    this.updateThreeCamera();
  }

  public getViewAngles(view: ViewCubeHit): { az: number; el: number } {
    switch (view) {
      case 'TOP':
        return { az: 0, el: 89.99 };
      case 'BOTTOM':
        return { az: 0, el: -89.99 };
      case 'FRONT':
        return { az: 0, el: 0 };
      case 'BACK':
        return { az: 180, el: 0 };
      case 'LEFT':
        return { az: -90, el: 0 };
      case 'RIGHT':
        return { az: 90, el: 0 };
      case 'HOME':
      case 'ISO_SW':
        return { az: -45, el: 30 };
      case 'ISO_SE':
        return { az: 45, el: 30 };
      case 'ISO_NE':
        return { az: 135, el: 30 };
      case 'ISO_NW':
        return { az: -135, el: 30 };
      case 'ISO_SW_BOT':
        return { az: -45, el: -30 };
      case 'ISO_SE_BOT':
        return { az: 45, el: -30 };
      case 'ISO_NE_BOT':
        return { az: 135, el: -30 };
      case 'ISO_NW_BOT':
        return { az: -135, el: -30 };
      case 'EDGE_TF':
        return { az: 0, el: 45 };
      case 'EDGE_TB':
        return { az: 180, el: 45 };
      case 'EDGE_TL':
        return { az: -90, el: 45 };
      case 'EDGE_TR':
        return { az: 90, el: 45 };
      case 'EDGE_FL':
        return { az: -45, el: 0 };
      case 'EDGE_FR':
        return { az: 45, el: 0 };
      case 'EDGE_BL':
        return { az: -135, el: 0 };
      case 'EDGE_BR':
        return { az: 135, el: 0 };
      case 'ROLL_CCW':
        return { az: this.camera.azimuth - 90, el: this.camera.elevation };
      case 'ROLL_CW':
        return { az: this.camera.azimuth + 90, el: this.camera.elevation };
      case 'COMPASS_N': {
        const el = Math.abs(this.camera.elevation) > 60 ? this.camera.elevation : (this.camera.elevation > 15 ? 30 : 0);
        return { az: 0, el };
      }
      case 'COMPASS_E': {
        const el = Math.abs(this.camera.elevation) > 60 ? this.camera.elevation : (this.camera.elevation > 15 ? 30 : 0);
        return { az: 90, el };
      }
      case 'COMPASS_S': {
        const el = Math.abs(this.camera.elevation) > 60 ? this.camera.elevation : (this.camera.elevation > 15 ? 30 : 0);
        return { az: 180, el };
      }
      case 'COMPASS_W': {
        const el = Math.abs(this.camera.elevation) > 60 ? this.camera.elevation : (this.camera.elevation > 15 ? 30 : 0);
        return { az: -90, el };
      }
      default:
        return { az: this.camera.azimuth, el: this.camera.elevation };
    }
  }

  public setStandardView(view: ViewCubeHit) {
    const { az, el } = this.getViewAngles(view);
    this.camera.azimuth = az;
    this.camera.elevation = el;
    this.updateThreeCamera();
  }

  // --- Smooth Camera Transition Animation ---
  private animFrameId: number | null = null;

  public animateCameraTo(
    targetAzimuth: number,
    targetElevation: number,
    duration = 320,
    onUpdate?: () => void,
    onComplete?: () => void
  ) {
    this.stopCameraAnimation();

    const startAz = this.camera.azimuth;
    const startEl = this.camera.elevation;

    // Calculate shortest angular path on circle (-180° to +180°)
    const deltaAz = ((((targetAzimuth - startAz) % 360) + 540) % 360) - 180;
    const deltaEl = targetElevation - startEl;

    if (Math.abs(deltaAz) < 0.05 && Math.abs(deltaEl) < 0.05) {
      this.camera.azimuth = targetAzimuth;
      this.camera.elevation = targetElevation;
      this.updateThreeCamera();
      if (onUpdate) onUpdate();
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth easeInOutCubic curve
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.azimuth = (startAz + deltaAz * ease) % 360;
      this.camera.elevation = Math.max(-89.99, Math.min(89.99, startEl + deltaEl * ease));
      this.updateThreeCamera();

      if (onUpdate) onUpdate();

      if (progress < 1) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.camera.azimuth = targetAzimuth;
        this.camera.elevation = targetElevation;
        this.updateThreeCamera();
        this.animFrameId = null;
        if (onUpdate) onUpdate();
        if (onComplete) onComplete();
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  public stopCameraAnimation() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public clearModelGroup() {
    this.clearGroup(this.modelGroup);
    this.clearGroup(this.overlayGroup);
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material.dispose();
        }
      }
    }
  }

  public renderWebGL(isDark: boolean) {
    if (!this.renderer) return;
    this.updateThreeCamera();
    const bgColor = new THREE.Color(isDark ? 0x0e1520 : 0xeef2f6);

    // Disable auto-clear to execute our two-layer depth-ordered passes
    this.renderer.autoClear = false;
    this.scene.background = bgColor;
    this.renderer.clear();

    // 1. Pass 1: Render structural model (grid, construction lines, panels, bars, supports, nodes, deform, diagrams)
    this.modelGroup.visible = true;
    this.overlayGroup.visible = false;
    this.renderer.render(this.scene, this.threeCamera);

    // 2. Clear depth buffer so loads, axes and symbols render on top of the model
    this.renderer.clearDepth();

    // 3. Pass 2: Render 3D symbols, loads, axes with depth testing and occlusion among themselves
    this.modelGroup.visible = false;
    this.overlayGroup.visible = true;
    this.scene.background = null;
    this.renderer.render(this.scene, this.threeCamera);

    // 4. Restore state
    this.modelGroup.visible = true;
    this.overlayGroup.visible = true;
    this.scene.background = bgColor;
  }

  // --- ViewCube Drawing & Interaction ---
  public getViewCubeCenter(): { cx: number; cy: number } {
    return {
      cx: this.width - this.cubeMargin - this.cubeSize / 2 - 14,
      cy: this.cubeMargin + this.cubeSize / 2 + 14,
    };
  }

  public drawViewCube(ctx: CanvasRenderingContext2D, hoverHit: ViewCubeHit | null) {
    const { cx, cy } = this.getViewCubeCenter();
    const rRing = this.cubeSize * 0.72;
    const cornerOffset = 49;
    const rBtn = 11;

    ctx.save();

    // Helper to draw circular corner buttons outside compass
    const drawCornerBtn = (bx: number, by: number, isHov: boolean, drawIcon: () => void) => {
      ctx.beginPath();
      ctx.arc(bx, by, rBtn, 0, 2 * Math.PI);
      ctx.fillStyle = isHov ? '#2563eb' : 'rgba(30, 41, 59, 0.88)';
      ctx.fill();
      ctx.strokeStyle = isHov ? '#93c5fd' : 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      drawIcon();
    };

    // 1. Compass Base Disc & Outer Ring
    ctx.beginPath();
    ctx.arc(cx, cy, rRing, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Subtle inner groove ring
    ctx.beginPath();
    ctx.arc(cx, cy, rRing - 13, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Compass Tick Marks (every 15° and 45°)
    for (let deg = 0; deg < 360; deg += 15) {
      const angRad = ((deg + this.camera.azimuth) * Math.PI) / 180;
      const isMajor = deg % 90 === 0;
      const isMid = deg % 45 === 0;
      const len = isMajor ? 5 : isMid ? 3.5 : 2;
      const r1 = rRing - 1;
      const r2 = rRing - 1 - len;

      const x1 = cx + r1 * Math.sin(angRad);
      const y1 = cy - r1 * Math.cos(angRad);
      const x2 = cx + r2 * Math.sin(angRad);
      const y2 = cy - r2 * Math.cos(angRad);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? '#94a3b8' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = isMajor ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Cardinal directions on compass ring (N, E, S, W)
    const cardinals: { label: string; ang: number; hit: ViewCubeHit; color: string }[] = [
      { label: 'N', ang: 0, hit: 'COMPASS_N', color: '#f43f5e' },
      { label: 'E', ang: 90, hit: 'COMPASS_E', color: '#e2e8f0' },
      { label: 'S', ang: 180, hit: 'COMPASS_S', color: '#cbd5e1' },
      { label: 'W', ang: 270, hit: 'COMPASS_W', color: '#e2e8f0' },
    ];

    cardinals.forEach(({ label, ang, hit, color }) => {
      const angRad = ((ang + this.camera.azimuth) * Math.PI) / 180;
      const px = cx + (rRing - 7) * Math.sin(angRad);
      const py = cy - (rRing - 7) * Math.cos(angRad);
      const isHov = hoverHit === hit;

      if (isHov) {
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.strokeStyle = '#bfdbfe';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.font = label === 'N' ? 'bold 10px sans-serif' : 'bold 9px sans-serif';
      ctx.fillStyle = isHov ? '#ffffff' : color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, py);
    });

    // North Pointer (Arrow on ring)
    const nRad = (this.camera.azimuth * Math.PI) / 180;
    const nx = cx + (rRing + 3) * Math.sin(nRad);
    const ny = cy - (rRing + 3) * Math.cos(nRad);
    const nL = [cx + (rRing - 2) * Math.sin(nRad - 0.12), cy - (rRing - 2) * Math.cos(nRad - 0.12)];
    const nR = [cx + (rRing - 2) * Math.sin(nRad + 0.12), cy - (rRing - 2) * Math.cos(nRad + 0.12)];

    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(nL[0], nL[1]);
    ctx.lineTo(nR[0], nR[1]);
    ctx.closePath();
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    // 2. Corner Navigation Buttons (Outside the compass circle)
    // 2a. Top-Left: Home Button (Domek)
    const hx = cx - cornerOffset;
    const hy = cy - cornerOffset;
    const isHomeHov = hoverHit === 'HOME';

    drawCornerBtn(hx, hy, isHomeHov, () => {
      ctx.beginPath();
      // Roof peak
      ctx.moveTo(hx, hy - 5.5);
      ctx.lineTo(hx - 5.2, hy - 0.6);
      ctx.lineTo(hx - 3.3, hy - 0.6);
      ctx.lineTo(hx - 3.3, hy + 4.8);
      ctx.lineTo(hx + 3.3, hy + 4.8);
      ctx.lineTo(hx + 3.3, hy - 0.6);
      ctx.lineTo(hx + 5.2, hy - 0.6);
      ctx.closePath();
      ctx.fillStyle = isHomeHov ? '#ffffff' : '#f1f5f9';
      ctx.fill();

      // Door cutout
      ctx.beginPath();
      ctx.rect(hx - 1.2, hy + 1.2, 2.4, 3.6);
      ctx.fillStyle = isHomeHov ? '#2563eb' : 'rgba(30, 41, 59, 0.88)';
      ctx.fill();
    });

    // 2b. Top-Right: Fit Button (Dopasuj widok)
    const fx = cx + cornerOffset;
    const fy = cy - cornerOffset;
    const isFitHov = hoverHit === 'FIT';

    drawCornerBtn(fx, fy, isFitHov, () => {
      ctx.strokeStyle = isFitHov ? '#ffffff' : '#f1f5f9';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const d = 4.8;
      const arm = 2.4;

      ctx.beginPath();
      // Top-Left corner bracket
      ctx.moveTo(fx - d, fy - d + arm);
      ctx.lineTo(fx - d, fy - d);
      ctx.lineTo(fx - d + arm, fy - d);

      // Top-Right corner bracket
      ctx.moveTo(fx + d - arm, fy - d);
      ctx.lineTo(fx + d, fy - d);
      ctx.lineTo(fx + d, fy - d + arm);

      // Bottom-Left corner bracket
      ctx.moveTo(fx - d, fy + d - arm);
      ctx.lineTo(fx - d, fy + d);
      ctx.lineTo(fx - d + arm, fy + d);

      // Bottom-Right corner bracket
      ctx.moveTo(fx + d - arm, fy + d);
      ctx.lineTo(fx + d, fy + d);
      ctx.lineTo(fx + d, fy + d - arm);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(fx, fy, 1.2, 0, 2 * Math.PI);
      ctx.fillStyle = isFitHov ? '#ffffff' : '#f1f5f9';
      ctx.fill();
    });

    // 2c. Bottom-Left: Roll CCW Button (Obróć w lewo)
    const rCCWx = cx - cornerOffset;
    const rCCWy = cy + cornerOffset;
    const isCCWHov = hoverHit === 'ROLL_CCW';

    drawCornerBtn(rCCWx, rCCWy, isCCWHov, () => {
      ctx.save();
      ctx.translate(rCCWx, rCCWy);
      ctx.scale(0.5, 0.5);
      ctx.translate(-12, -12);
      ctx.strokeStyle = isCCWHov ? '#ffffff' : '#f1f5f9';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const p1 = new Path2D("M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8");
      const p2 = new Path2D("M3 3v5h5");
      ctx.stroke(p1);
      ctx.stroke(p2);
      ctx.restore();
    });

    // 2d. Bottom-Right: Roll CW Button (Obróć w prawo)
    const rCWx = cx + cornerOffset;
    const rCWy = cy + cornerOffset;
    const isCWHov = hoverHit === 'ROLL_CW';

    drawCornerBtn(rCWx, rCWy, isCWHov, () => {
      ctx.save();
      ctx.translate(rCWx, rCWy);
      ctx.scale(0.5, 0.5);
      ctx.translate(-12, -12);
      ctx.strokeStyle = isCWHov ? '#ffffff' : '#f1f5f9';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const p1 = new Path2D("M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8");
      const p2 = new Path2D("M21 3v5h-5");
      ctx.stroke(p1);
      ctx.stroke(p2);
      ctx.restore();
    });

    // 3. 3D Mini Cube Projection & Shading
    const s = this.cubeSize * 0.34;
    const { right, up, forward } = this.getCameraBasis();

    const rawVerts: Vec3[] = [
      [-1, -1, -1], // 0: BLF (-X, -Y, -Z)
      [1, -1, -1],  // 1: BRF (+X, -Y, -Z)
      [1, 1, -1],   // 2: BRB (+X, +Y, -Z)
      [-1, 1, -1],  // 3: BLB (-X, +Y, -Z)
      [-1, -1, 1],  // 4: TLF (-X, -Y, +Z)
      [1, -1, 1],   // 5: TRF (+X, -Y, +Z)
      [1, 1, 1],    // 6: TRB (+X, +Y, +Z)
      [-1, 1, 1],   // 7: TLB (-X, +Y, +Z)
    ];

    const projVerts = rawVerts.map((v) => {
      const vWorld: Vec3 = [v[0] * s, v[1] * s, v[2] * s];
      const xCam = vec3Dot(vWorld, right);
      const yCam = vec3Dot(vWorld, up);
      const zCam = vec3Dot(vWorld, forward);
      return {
        sx: cx + xCam,
        sy: cy - yCam,
        z: zCam,
      };
    });

    interface FaceDef {
      name: ViewCubeHit;
      label: string;
      vIdx: number[];
      normal: Vec3;
    }

    const faces: FaceDef[] = [
      { name: 'TOP', label: 'GÓRA', vIdx: [4, 5, 6, 7], normal: [0, 0, 1] },
      { name: 'BOTTOM', label: 'DÓŁ', vIdx: [0, 3, 2, 1], normal: [0, 0, -1] },
      { name: 'FRONT', label: 'PRZÓD', vIdx: [0, 1, 5, 4], normal: [0, -1, 0] },
      { name: 'BACK', label: 'TYŁ', vIdx: [2, 3, 7, 6], normal: [0, 1, 0] },
      { name: 'LEFT', label: 'LEWO', vIdx: [3, 0, 4, 7], normal: [-1, 0, 0] },
      { name: 'RIGHT', label: 'PRAWO', vIdx: [1, 2, 6, 5], normal: [1, 0, 0] },
    ];

    const sortedFaces = faces
      .map((f) => {
        const dotCam = vec3Dot(f.normal, forward);
        let avgZ = 0;
        f.vIdx.forEach((idx) => (avgZ += projVerts[idx].z));
        avgZ /= 4;
        return { ...f, dotCam, avgZ };
      })
      .sort((a, b) => b.avgZ - a.avgZ);

    sortedFaces.forEach((f) => {
      if (f.dotCam < 0.01) {
        const p0 = projVerts[f.vIdx[0]];
        const p1 = projVerts[f.vIdx[1]];
        const p2 = projVerts[f.vIdx[2]];
        const p3 = projVerts[f.vIdx[3]];

        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.closePath();

        const isFaceHover = hoverHit === f.name;

        // Directional shading calculation for 3D realism
        const nx = f.normal[0], ny = f.normal[1], nz = f.normal[2];
        const light = Math.max(0.4, 0.65 + 0.3 * nz - 0.25 * ny + 0.15 * nx);
        const baseR = Math.round(28 * light + 14);
        const baseG = Math.round(38 * light + 18);
        const baseB = Math.round(52 * light + 24);

        ctx.fillStyle = isFaceHover 
          ? '#2563eb' 
          : `rgba(${baseR}, ${baseG}, ${baseB}, 0.88)`;
        ctx.fill();

        ctx.strokeStyle = isFaceHover ? '#93c5fd' : 'rgba(148, 163, 184, 0.55)';
        ctx.lineWidth = isFaceHover ? 1.8 : 1.2;
        ctx.stroke();

        // Check if any Corner on this face is hovered
        const cornerMap: { [vIdx: number]: ViewCubeHit } = {
          4: 'ISO_SW',
          5: 'ISO_SE',
          6: 'ISO_NE',
          7: 'ISO_NW',
          0: 'ISO_SW_BOT',
          1: 'ISO_SE_BOT',
          2: 'ISO_NE_BOT',
          3: 'ISO_NW_BOT',
        };

        f.vIdx.forEach((vIndex) => {
          if (hoverHit && hoverHit === cornerMap[vIndex]) {
            const cp = projVerts[vIndex];
            ctx.beginPath();
            ctx.arc(cp.sx, cp.sy, 6.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
            ctx.strokeStyle = '#bfdbfe';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });

        // Check if any Edge on this face is hovered
        const edgeList: { v1: number; v2: number; hit: ViewCubeHit }[] = [
          { v1: 4, v2: 5, hit: 'EDGE_TF' },
          { v1: 7, v2: 6, hit: 'EDGE_TB' },
          { v1: 4, v2: 7, hit: 'EDGE_TL' },
          { v1: 5, v2: 6, hit: 'EDGE_TR' },
          { v1: 0, v2: 4, hit: 'EDGE_FL' },
          { v1: 1, v2: 5, hit: 'EDGE_FR' },
          { v1: 3, v2: 7, hit: 'EDGE_BL' },
          { v1: 2, v2: 6, hit: 'EDGE_BR' },
        ];

        edgeList.forEach(({ v1, v2, hit }) => {
          if (hoverHit === hit && f.vIdx.includes(v1) && f.vIdx.includes(v2)) {
            const ep1 = projVerts[v1];
            const ep2 = projVerts[v2];
            ctx.beginPath();
            ctx.moveTo(ep1.sx, ep1.sy);
            ctx.lineTo(ep2.sx, ep2.sy);
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 3.5;
            ctx.stroke();
          }
        });

        // Face Center Text Label
        let fcx = (p0.sx + p1.sx + p2.sx + p3.sx) / 4;
        let fcy = (p0.sy + p1.sy + p2.sy + p3.sy) / 4;

        ctx.font = 'bold 8.5px sans-serif';
        ctx.fillStyle = isFaceHover ? '#ffffff' : '#f1f5f9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.label, fcx, fcy);
      }
    });

    ctx.restore();
  }

  public hitTestViewCube(px: number, py: number): ViewCubeHit | null {
    const { cx, cy } = this.getViewCubeCenter();
    const dist = Math.hypot(px - cx, py - cy);
    const rRing = this.cubeSize * 0.72;
    const cornerOffset = 49;
    const hitRadius = 13;

    // 1. Four Corner Buttons Test
    // 1a. Top-Left: Home
    const hx = cx - cornerOffset;
    const hy = cy - cornerOffset;
    if (Math.hypot(px - hx, py - hy) <= hitRadius) return 'HOME';

    // 1b. Top-Right: Fit
    const fx = cx + cornerOffset;
    const fy = cy - cornerOffset;
    if (Math.hypot(px - fx, py - fy) <= hitRadius) return 'FIT';

    // 1c. Bottom-Left: Roll CCW
    const rCCWx = cx - cornerOffset;
    const rCCWy = cy + cornerOffset;
    if (Math.hypot(px - rCCWx, py - rCCWy) <= hitRadius) return 'ROLL_CCW';

    // 1d. Bottom-Right: Roll CW
    const rCWx = cx + cornerOffset;
    const rCWy = cy + cornerOffset;
    if (Math.hypot(px - rCWx, py - rCWy) <= hitRadius) return 'ROLL_CW';

    // If outside interactive ring perimeter + margin
    if (dist > rRing + 8) return null;

    // 3. Cardinal Compass points test (N, E, S, W)
    const cardinals: { hit: ViewCubeHit; ang: number }[] = [
      { hit: 'COMPASS_N', ang: 0 },
      { hit: 'COMPASS_E', ang: 90 },
      { hit: 'COMPASS_S', ang: 180 },
      { hit: 'COMPASS_W', ang: 270 },
    ];

    for (const card of cardinals) {
      const angRad = ((card.ang + this.camera.azimuth) * Math.PI) / 180;
      const cpx = cx + (rRing - 7) * Math.sin(angRad);
      const cpy = cy - (rRing - 7) * Math.cos(angRad);
      if (Math.hypot(px - cpx, py - cpy) <= 10) return card.hit;
    }

    // 4. 3D Cube Projection & Hit Testing (Faces, Corners, Edges)
    const s = this.cubeSize * 0.34;
    const { right, up, forward } = this.getCameraBasis();

    const rawVerts: Vec3[] = [
      [-1, -1, -1], // 0: BLF (-X, -Y, -Z)
      [1, -1, -1],  // 1: BRF (+X, -Y, -Z)
      [1, 1, -1],   // 2: BRB (+X, +Y, -Z)
      [-1, 1, -1],  // 3: BLB (-X, +Y, -Z)
      [-1, -1, 1],  // 4: TLF (-X, -Y, +Z)
      [1, -1, 1],   // 5: TRF (+X, -Y, +Z)
      [1, 1, 1],    // 6: TRB (+X, +Y, +Z)
      [-1, 1, 1],   // 7: TLB (-X, +Y, +Z)
    ];

    const projVerts = rawVerts.map((v) => {
      const vWorld: Vec3 = [v[0] * s, v[1] * s, v[2] * s];
      const xCam = vec3Dot(vWorld, right);
      const yCam = vec3Dot(vWorld, up);
      const zCam = vec3Dot(vWorld, forward);
      return { sx: cx + xCam, sy: cy - yCam, z: zCam };
    });

    const faces: { name: ViewCubeHit; vIdx: number[]; normal: Vec3 }[] = [
      { name: 'TOP', vIdx: [4, 5, 6, 7], normal: [0, 0, 1] },
      { name: 'BOTTOM', vIdx: [0, 3, 2, 1], normal: [0, 0, -1] },
      { name: 'FRONT', vIdx: [0, 1, 5, 4], normal: [0, -1, 0] },
      { name: 'BACK', vIdx: [2, 3, 7, 6], normal: [0, 1, 0] },
      { name: 'LEFT', vIdx: [3, 0, 4, 7], normal: [-1, 0, 0] },
      { name: 'RIGHT', vIdx: [1, 2, 6, 5], normal: [1, 0, 0] },
    ];

    const cornerMap: { [vIdx: number]: ViewCubeHit } = {
      4: 'ISO_SW',
      5: 'ISO_SE',
      6: 'ISO_NE',
      7: 'ISO_NW',
      0: 'ISO_SW_BOT',
      1: 'ISO_SE_BOT',
      2: 'ISO_NE_BOT',
      3: 'ISO_NW_BOT',
    };

    const edgeList: { v1: number; v2: number; hit: ViewCubeHit }[] = [
      { v1: 4, v2: 5, hit: 'EDGE_TF' },
      { v1: 7, v2: 6, hit: 'EDGE_TB' },
      { v1: 4, v2: 7, hit: 'EDGE_TL' },
      { v1: 5, v2: 6, hit: 'EDGE_TR' },
      { v1: 0, v2: 4, hit: 'EDGE_FL' },
      { v1: 1, v2: 5, hit: 'EDGE_FR' },
      { v1: 3, v2: 7, hit: 'EDGE_BL' },
      { v1: 2, v2: 6, hit: 'EDGE_BR' },
    ];

    // Check visible faces in order of camera depth (front to back)
    const sortedFaces = faces
      .map((f) => {
        let avgZ = 0;
        f.vIdx.forEach((idx) => (avgZ += projVerts[idx].z));
        avgZ /= 4;
        return { ...f, avgZ };
      })
      .sort((a, b) => a.avgZ - b.avgZ);

    for (const f of sortedFaces) {
      if (vec3Dot(f.normal, forward) < 0.01) {
        const poly = f.vIdx.map((idx) => projVerts[idx]);
        if (pointInPolygon(px, py, poly)) {
          // Check corner proximity inside the polygon
          for (const vIdx of f.vIdx) {
            const vPt = projVerts[vIdx];
            if (Math.hypot(px - vPt.sx, py - vPt.sy) < 9) {
              return cornerMap[vIdx] || f.name;
            }
          }

          // Check edge proximity inside polygon
          for (const edge of edgeList) {
            if (f.vIdx.includes(edge.v1) && f.vIdx.includes(edge.v2)) {
              const p1 = projVerts[edge.v1];
              const p2 = projVerts[edge.v2];
              if (distToSegment(px, py, p1.sx, p1.sy, p2.sx, p2.sy) < 6.5) {
                return edge.hit;
              }
            }
          }

          return f.name;
        }
      }
    }

    // 5. If clicked on compass disc outside 3D cube -> Iso corner snap
    if (dist <= rRing) {
      if (px < cx && py < cy) return 'ISO_NW';
      if (px >= cx && py < cy) return 'ISO_NE';
      if (px < cx && py >= cy) return 'ISO_SW';
      return 'ISO_SE';
    }

    return null;
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-4) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInPolygon(px: number, py: number, poly: { sx: number; sy: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].sx;
    const yi = poly[i].sy;
    const xj = poly[j].sx;
    const yj = poly[j].sy;

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
