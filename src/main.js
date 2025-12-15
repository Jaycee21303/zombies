import * as THREE from 'https://cdn.skypack.dev/three@0.160.1';

const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(canvasWidth, canvasHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);

const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(3, 4, 2);
scene.add(directional);

const overlay = document.getElementById('overlay');
const hitmarker = document.getElementById('hitmarker');
const pointsEl = document.getElementById('points');
const ammoEl = document.getElementById('ammo');
const roundEl = document.getElementById('round');
const healthEl = document.getElementById('health');
const messageEl = document.getElementById('messages');
const menuEl = document.getElementById('menu');
const startBtn = document.getElementById('start');

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  reload: false,
  rebuild: false,
  buy: false,
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, duration, gain = 0.05) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(audioCtx.destination);
  g.gain.value = gain;
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

class PointerLook {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.enabled = false;
    this.sensitivity = 0.0025;
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      this.update();
    });
  }
  update() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}

const pointer = new PointerLook(camera);
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const floorSize = { x: 24, z: 24 };
const startRoom = new THREE.Vector3(0, 0, 0);

const objects = [];
function addBox(pos, size, color = 0x333333) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  objects.push(mesh);
  return mesh;
}

function makeRoom(origin) {
  addBox(origin.clone().add(new THREE.Vector3(0, -0.5, 0)), { x: floorSize.x, y: 1, z: floorSize.z }, 0x111111);
  const wallThickness = 0.5;
  addBox(origin.clone().add(new THREE.Vector3(0, 1.75, -floorSize.z / 2)), { x: floorSize.x, y: 3.5, z: wallThickness }, 0x222222);
  addBox(origin.clone().add(new THREE.Vector3(0, 1.75, floorSize.z / 2)), { x: floorSize.x, y: 3.5, z: wallThickness }, 0x222222);
  addBox(origin.clone().add(new THREE.Vector3(-floorSize.x / 2, 1.75, 0)), { x: wallThickness, y: 3.5, z: floorSize.z }, 0x222222);
  addBox(origin.clone().add(new THREE.Vector3(floorSize.x / 2, 1.75, 0)), { x: wallThickness, y: 3.5, z: floorSize.z }, 0x222222);
}

makeRoom(startRoom);

const secondRoomOrigin = new THREE.Vector3(floorSize.x + 4, 0, 0);
makeRoom(secondRoomOrigin);

function makeDoorway(pos, size, cost) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mat = new THREE.MeshLambertMaterial({ color: 0x663300, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.userData = { cost, open: false };
  scene.add(mesh);
  objects.push(mesh);
  return mesh;
}

const door = makeDoorway(new THREE.Vector3(floorSize.x / 2 + 2, 1, 0), { x: 1, y: 2, z: 4 }, 750);

const spawnPoints = [
  { pos: new THREE.Vector3(-floorSize.x / 2 + 1, 0, -floorSize.z / 2 + 4), room: 'start' },
  { pos: new THREE.Vector3(-floorSize.x / 2 + 1, 0, floorSize.z / 2 - 4), room: 'start' },
  { pos: secondRoomOrigin.clone().add(new THREE.Vector3(floorSize.x / 2 - 1, 0, -floorSize.z / 2 + 4)), room: 'hall' },
  { pos: secondRoomOrigin.clone().add(new THREE.Vector3(floorSize.x / 2 - 1, 0, floorSize.z / 2 - 4)), room: 'hall' },
];

function allowedSpawns() {
  return door.userData.open ? spawnPoints : spawnPoints.filter((s) => s.room === 'start');
}

let spawnOrderIndex = 0;
function dequeueSpawn() {
  const available = allowedSpawns();
  if (available.length === 0) return spawnPoints[0];
  const spawn = available[spawnOrderIndex % available.length];
  spawnOrderIndex = (spawnOrderIndex + 1) % available.length;
  return spawn;
}

class Barricade {
  constructor(spawn) {
    this.spawn = spawn;
    this.boards = 6;
    this.targetBoards = this.boards;
    this.boardMeshes = [];
    this.group = new THREE.Group();
    const width = 2.4;
    for (let i = 0; i < this.boards; i++) {
      const geo = new THREE.BoxGeometry(width, 0.2, 0.4);
      const mat = new THREE.MeshLambertMaterial({ color: 0x996633 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spawn.pos.x, 1 + i * 0.25, spawn.pos.z);
      this.group.add(mesh);
      this.boardMeshes.push(mesh);
    }
    scene.add(this.group);
  }
  takeDamage(dt) {
    if (this.targetBoards <= 0) return;
    this.targetBoards = Math.max(0, this.targetBoards - dt * 1.5);
  }
  rebuild() {
    if (this.targetBoards >= this.boards) return false;
    this.targetBoards = Math.min(this.boards, this.targetBoards + 1);
    return true;
  }
  update(dt) {
    this.boardMeshes.forEach((mesh, idx) => {
      const visible = this.targetBoards >= idx + 0.9;
      mesh.visible = visible;
    });
  }
  isOpen() {
    return this.targetBoards <= 0.1;
  }
}

const barricades = spawnPoints.map((s) => new Barricade(s));

function roundHealth(round) {
  if (round === 1) return 150;
  if (round <= 5) return 150 + (round - 1) * 75;
  const exponential = 400 * Math.pow(1.12, round - 6);
  return Math.min(4500, exponential);
}

function roundSpeed(round) {
  if (round <= 3) return 0.65 + 0.05 * round;
  if (round <= 10) return 0.9 + 0.08 * (round - 3);
  return 1.5 + 0.04 * (round - 10);
}

class Zombie {
  constructor(round) {
    this.health = roundHealth(round);
    this.baseSpeed = roundSpeed(round);
    this.damage = 30;
    this.attackCooldown = 1.2;
    this.attackTimer = 0;
    this.mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.25, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x556655 })
    );
    this.mesh.userData.isZombie = true;
    const spawn = dequeueSpawn();
    this.spawn = spawn;
    this.mesh.position.copy(spawn.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    scene.add(this.mesh);
    this.state = 'moving';
  }
  update(dt, player, barricade) {
    this.attackTimer -= dt;
    const targetPos = player.position.clone();
    const towardsBarricade = barricade && !barricade.isOpen();
    if (towardsBarricade) {
      targetPos.copy(barricade.spawn.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    }
    const dir = targetPos.clone().sub(this.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.001) dir.normalize();
    const sprintFactor = dist < 6 ? 1.4 : dist > 14 ? 0.85 : 1;
    const speed = this.baseSpeed * sprintFactor;
    this.mesh.position.add(dir.multiplyScalar(speed * dt));
    if (towardsBarricade && dist < 0.85) {
      barricade.takeDamage(dt);
    }
    if (!towardsBarricade && dist < 1) {
      if (this.attackTimer <= 0) {
        player.takeDamage(this.damage);
        this.attackTimer = this.attackCooldown;
      }
    }
  }
  damage(amount) {
    this.health -= amount;
  }
  isDead() {
    return this.health <= 0;
  }
  dispose() {
    scene.remove(this.mesh);
  }
}

class Weapon {
  constructor(config) {
    Object.assign(this, config);
    this.ammoInMag = this.magSize;
    this.reserve = this.maxReserve;
    this.cooldown = 0;
    this.reloadTimer = 0;
  }
  canFire() {
    return this.cooldown <= 0 && this.reloadTimer <= 0 && this.ammoInMag > 0;
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    if (this.reloadTimer === 0 && this.reloading) {
      const needed = this.magSize - this.ammoInMag;
      const load = Math.min(needed, this.reserve);
      this.ammoInMag += load;
      this.reserve -= load;
      this.reloading = false;
    }
  }
  reload() {
    if (this.reloadTimer > 0 || this.ammoInMag === this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = this.reloadTime;
  }
  fire() {
    if (!this.canFire()) return false;
    this.ammoInMag -= 1;
    this.cooldown = 1 / this.fireRate;
    return true;
  }
}

class Player {
  constructor() {
    this.position = new THREE.Vector3(0, 1.6, 0);
    this.health = 100;
    this.points = 500;
    this.down = false;
    this.speed = 4.2;
    this.weapons = {
      pistol: new Weapon({ name: 'M1911', damage: 35, magSize: 8, maxReserve: 72, fireRate: 3, reloadTime: 1.5, price: 0 }),
      smg: new Weapon({ name: 'MP5', damage: 20, magSize: 30, maxReserve: 150, fireRate: 10, reloadTime: 2, price: 1000 }),
      rifle: new Weapon({ name: 'Carbine', damage: 45, magSize: 12, maxReserve: 60, fireRate: 2.5, reloadTime: 2.4, price: 1200 })
    };
    this.current = this.weapons.pistol;
  }
  switchWeapon(id) {
    if (this.weapons[id]) this.current = this.weapons[id];
  }
  takeDamage(amount) {
    this.health -= amount;
    overlay.style.background = 'rgba(200,0,0,0.4)';
    setTimeout(() => (overlay.style.background = 'rgba(200,0,0,0)'), 150);
    if (this.health <= 0 && !this.down) {
      this.down = true;
      showMessage('You are down! Press R to restart');
    }
  }
  reset() {
    this.position.set(0, 1.6, 0);
    this.health = 100;
    this.points = 500;
    this.down = false;
    Object.values(this.weapons).forEach((w) => {
      w.ammoInMag = w.magSize;
      w.reserve = w.maxReserve;
      w.cooldown = 0;
      w.reloadTimer = 0;
    });
    this.current = this.weapons.pistol;
  }
}

const player = new Player();

const wallBuys = [
  { weapon: 'smg', cost: 1000, pos: new THREE.Vector3(-floorSize.x / 2 + 1, 1, 0) },
  { weapon: 'rifle', cost: 1200, pos: secondRoomOrigin.clone().add(new THREE.Vector3(floorSize.x / 2 - 1, 1, 0)) }
];

function showMessage(text, duration = 2) {
  messageEl.textContent = text;
  if (duration > 0) setTimeout(() => {
    if (messageEl.textContent === text) messageEl.textContent = '';
  }, duration * 1000);
}

function updateHUD(round) {
  pointsEl.textContent = Math.floor(player.points);
  ammoEl.textContent = `${player.current.ammoInMag}/${player.current.reserve}`;
  healthEl.textContent = Math.max(0, Math.floor(player.health));
  roundEl.textContent = `Round ${round}`;
}

const raycaster = new THREE.Raycaster();
let zombies = [];
let round = 1;
let timeSinceRoundEnd = 0;
let enemyQueue = [];
let betweenRounds = false;
let spawnTimer = 0;
let spawnInterval = 1.2;

function resetMatch() {
  zombies.forEach((z) => z.dispose());
  zombies = [];
  round = 1;
  timeSinceRoundEnd = 0;
  enemyQueue = [];
  betweenRounds = false;
  spawnTimer = 0;
  barricades.forEach((b) => (b.targetBoards = b.boards));
  player.reset();
  pointer.yaw = 0;
  pointer.pitch = 0;
  camera.position.copy(player.position);
  pointer.update();
  startRound();
}

function startRound() {
  betweenRounds = false;
  const enemiesThisRound = Math.min(50, Math.floor(8 + round * 3.5));
  enemyQueue = Array.from({ length: enemiesThisRound }, (_, i) => i);
  spawnInterval = Math.max(0.45, 1.8 - round * 0.08);
  spawnTimer = spawnInterval;
  showMessage(`Round ${round}`);
}

function endRoundCheck() {
  if (zombies.length === 0 && enemyQueue.length === 0 && !betweenRounds) {
    betweenRounds = true;
    timeSinceRoundEnd = 0;
    round += 1;
    showMessage('Next round incoming');
  }
}

function spawnZombie() {
  if (enemyQueue.length === 0) return;
  enemyQueue.pop();
  const z = new Zombie(round);
  zombies.push(z);
}

function handleShooting(dt) {
  if (!mouseDown) return;
  const wpn = player.current;
  if (!wpn.fire()) return;
  const roundPenalty = Math.max(0, round - 5) * 0.02;
  const damage = Math.max(10, wpn.damage * (1 - roundPenalty));
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(zombies.map((z) => z.mesh), false);
  const targetHit = intersects.find((hit) => hit.distance <= 35);
  if (!targetHit) return;
  const target = zombies.find((z) => z.mesh === targetHit.object);
  if (!target) return;
  target.damage(damage);
  player.points += 10;
  hitmarker.style.opacity = 1;
  setTimeout(() => (hitmarker.style.opacity = 0.35), 60);
  if (target.isDead()) {
    player.points += 50;
    target.dispose();
    zombies = zombies.filter((z) => z !== target);
  }
}

let lastTime = performance.now();
let mouseDown = false;

function update(delta) {
  const dt = delta / 1000;
  const moveSpeed = player.speed * (input.sprint ? 1.35 : 1.0);
  direction.set(0, 0, 0);
  if (input.forward) direction.z -= 1;
  if (input.backward) direction.z += 1;
  if (input.left) direction.x -= 1;
  if (input.right) direction.x += 1;
  direction.normalize();
  const move = direction.clone().applyEuler(new THREE.Euler(0, pointer.yaw, 0)).multiplyScalar(moveSpeed * dt);
  player.position.add(move);

  const minX = -floorSize.x / 2 + 1;
  const maxX = secondRoomOrigin.x + floorSize.x / 2 - 1;
  const minZ = -floorSize.z / 2 + 1;
  const maxZ = floorSize.z / 2 - 1;

  if (!door.userData.open && player.position.x > door.position.x - 0.6) {
    player.position.x = door.position.x - 0.6;
  }
  player.position.x = Math.min(Math.max(player.position.x, minX), maxX);
  player.position.z = Math.min(Math.max(player.position.z, minZ), maxZ);
  camera.position.copy(player.position);

  player.current.update(dt);

  barricades.forEach((b) => b.update(dt));

  for (const z of zombies) {
    const barricade = barricades.find((b) => b.spawn === z.spawn);
    z.update(dt, player, barricade);
  }
  zombies = zombies.filter((z) => {
    if (z.mesh.position.y < -10) return false;
    return true;
  });

  timeSinceRoundEnd += dt;
  if (betweenRounds && timeSinceRoundEnd > 4) {
    startRound();
  }

  spawnTimer = Math.max(0, spawnTimer - dt);
  const maxConcurrent = Math.min(24, Math.floor(6 + round * 1.4));
  if (!betweenRounds && enemyQueue.length > 0 && spawnTimer <= 0 && zombies.length < maxConcurrent) {
    spawnZombie();
    spawnTimer = spawnInterval;
  }

  endRoundCheck();
  handleShooting(dt);
  updateHUD(round);
}

function tryInteraction() {
  // barricade rebuild
  let rebuilt = false;
  barricades.forEach((b) => {
    const dist = b.spawn.pos.distanceTo(player.position);
    if (dist < 2 && !player.down && b.rebuild()) {
      player.points += 10;
      rebuilt = true;
    }
  });
  if (rebuilt) showMessage('Rebuilt window');
}

function tryPurchase() {
  const distToDoor = player.position.distanceTo(door.position);
  if (!door.userData.open && distToDoor < 2.5 && player.points >= door.userData.cost) {
    player.points -= door.userData.cost;
    door.userData.open = true;
    door.visible = false;
    spawnOrderIndex = 0;
    showMessage('Door opened');
    return;
  }
  for (const buy of wallBuys) {
    const dist = buy.pos.distanceTo(player.position);
    if (dist < 2) {
      const weapon = player.weapons[buy.weapon];
      if (player.points >= buy.cost) {
        player.points -= buy.cost;
        weapon.reserve = weapon.maxReserve;
        weapon.ammoInMag = weapon.magSize;
        player.switchWeapon(buy.weapon);
        showMessage(`${weapon.name} acquired`);
      }
    }
  }
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': input.forward = true; break;
    case 'KeyS': input.backward = true; break;
    case 'KeyA': input.left = true; break;
    case 'KeyD': input.right = true; break;
    case 'ShiftLeft': input.sprint = true; break;
    case 'KeyR':
      if (player.down) {
        resetMatch();
      } else {
        player.current.reload();
      }
      break;
    case 'KeyE': input.rebuild = true; tryInteraction(); break;
    case 'KeyF': input.buy = true; tryPurchase(); break;
    case 'Digit1': player.switchWeapon('pistol'); break;
    case 'Digit2': player.switchWeapon('smg'); break;
    case 'Digit3': player.switchWeapon('rifle'); break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': input.forward = false; break;
    case 'KeyS': input.backward = false; break;
    case 'KeyA': input.left = false; break;
    case 'KeyD': input.right = false; break;
    case 'ShiftLeft': input.sprint = false; break;
    case 'KeyE': input.rebuild = false; break;
    case 'KeyF': input.buy = false; break;
  }
});

window.addEventListener('mousedown', (e) => {
  if (!pointer.enabled) return;
  if (player.down) return;
  mouseDown = true;
});
window.addEventListener('mouseup', () => { mouseDown = false; });

document.body.addEventListener('click', () => {
  if (!pointer.enabled) return;
});

function enableGameplay() {
  menuEl.style.display = 'none';
  pointer.enabled = true;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (zombies.length === 0 && enemyQueue.length === 0) resetMatch();
}

function requestPointerLockWithFallback() {
  try {
    renderer.domElement.requestPointerLock();
  } catch (err) {
    enableGameplay();
    showMessage('Pointer lock unavailable, using fallback controls');
  }
}

startBtn.addEventListener('click', () => {
  enableGameplay();
  requestPointerLockWithFallback();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    pointer.enabled = true;
  } else {
    pointer.enabled = false;
    mouseDown = false;
  }
});

document.addEventListener('pointerlockerror', () => {
  enableGameplay();
  showMessage('Pointer lock denied. Gameplay enabled with fallback controls');
});

function render(now) {
  const delta = now - lastTime;
  lastTime = now;
  if (pointer.enabled && !player.down) {
    update(delta);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

resetMatch();
requestAnimationFrame(render);
