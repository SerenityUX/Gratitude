import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass';
import Bird from '../components/Bird';

// Custom PencilLinesPass for sketchy pencil effect
class PencilLinesPass extends Pass {
  constructor(scene, camera, width, height) {
    super();
    
    this.scene = scene;
    this.camera = camera;
    
    // Create normal buffer render target
    this.normalBuffer = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false
    });
    
    this.normalMaterial = new THREE.MeshNormalMaterial();
    
    // Create noise texture for line distortion
    this.noiseTexture = this.createNoiseTexture();
    
    // Create shader material for pencil effect
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uNormals: { value: null },
        uTexture: { value: this.noiseTexture },
        uResolution: { value: new THREE.Vector2(width, height) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D uNormals;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        
        varying vec2 vUv;
        
        // Gradient noise function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          
          vec2 u = f * f * (3.0 - 2.0 * f);
          
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }
        
        // Get value at specific point for Sobel operator
        float valueAtPoint(sampler2D tex, vec2 uv, vec2 texelSize, vec2 offset) {
          vec2 coord = uv + offset * texelSize;
          vec4 color = texture2D(tex, coord);
          return (color.r + color.g + color.b) / 3.0;
        }
        
        float diffuseValue(int x, int y) {
          return valueAtPoint(tDiffuse, vUv, vec2(1.0 / uResolution.x, 1.0 / uResolution.y), vec2(float(x), float(y)));
        }
        
        float normalValue(int x, int y) {
          float cutoff = 50.0;
          float offset = 0.5 / cutoff;
          float noiseValue = clamp(texture2D(uTexture, vUv).r, 0.0, cutoff) / cutoff - offset;
          
          return valueAtPoint(uNormals, vUv + noiseValue * 0.01, vec2(1.0 / uResolution.x, 1.0 / uResolution.y), vec2(float(x), float(y))) * 0.3;
        }
        
        float getValue(int x, int y) {
          float noiseValue = noise(gl_FragCoord.xy * 0.5);
          noiseValue = noiseValue * 2.0 - 1.0;
          noiseValue *= 10.0;
          
          return diffuseValue(x, y) + normalValue(x, y) * noiseValue;
        }
        
        // Sobel operator for edge detection
        float combinedSobelValue() {
          // Horizontal kernel
          float gx = 0.0;
          gx += -1.0 * getValue(-1, -1);
          gx += -2.0 * getValue(-1, 0);
          gx += -1.0 * getValue(-1, 1);
          gx += 1.0 * getValue(1, -1);
          gx += 2.0 * getValue(1, 0);
          gx += 1.0 * getValue(1, 1);
          
          // Vertical kernel
          float gy = 0.0;
          gy += -1.0 * getValue(-1, -1);
          gy += -2.0 * getValue(0, -1);
          gy += -1.0 * getValue(1, -1);
          gy += 1.0 * getValue(-1, 1);
          gy += 2.0 * getValue(0, 1);
          gy += 1.0 * getValue(1, 1);
          
          return sqrt(gx * gx + gy * gy);
        }
        
        void main() {
          float sobelValue = combinedSobelValue();
          sobelValue = smoothstep(0.01, 0.03, sobelValue);
          
          vec4 lineColor = vec4(0.15, 0.1, 0.12, 1.0);
          
          if (sobelValue > 0.1) {
            gl_FragColor = lineColor;
          } else {
            // Add paper texture effect
            vec4 baseColor = texture2D(tDiffuse, vUv);
            float paper = noise(gl_FragCoord.xy * 0.3) * 0.1 + 0.95;
            gl_FragColor = vec4(baseColor.rgb * paper, 1.0);
          }
        }
      `
    });
    
    this.fsQuad = new FullScreenQuad(this.material);
  }
  
  createNoiseTexture() {
    const size = 512;
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size * size; i++) {
      const stride = i * 4;
      const noise = Math.random() * 255;
      data[stride] = noise;
      data[stride + 1] = noise;
      data[stride + 2] = noise;
      data[stride + 3] = 255;
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    return texture;
  }
  
  setSize(width, height) {
    this.normalBuffer.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }
  
  render(renderer, writeBuffer, readBuffer) {
    // Render normal buffer
    renderer.setRenderTarget(this.normalBuffer);
    const overrideMaterialValue = this.scene.overrideMaterial;
    
    this.scene.overrideMaterial = this.normalMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = overrideMaterialValue;
    
    // Apply pencil effect
    this.material.uniforms.uNormals.value = this.normalBuffer.texture;
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }
  
  dispose() {
    this.normalBuffer.dispose();
    this.noiseTexture.dispose();
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

export default function Home() {
  const containerRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [audioUnmuted, setAudioUnmuted] = useState(false);
  const [showSpaceMessage, setShowSpaceMessage] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [showDiv, setShowDiv] = useState(false);
  const audioRef = useRef(null);
  const eagleAudioRef = useRef(null);
  const tiltStartTimeRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const sceneInstance = new THREE.Scene();
    sceneInstance.background = new THREE.Color(0xffd9b8); // Soft peachy sunrise background
    setScene(sceneInstance);
    
    // Create gradient sky using a shader
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `;
    
    const skyGeo = new THREE.SphereGeometry(550, 32, 15); // 2x larger to match render distance
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x5a9fd4) }, // Clear morning blue at top
        bottomColor: { value: new THREE.Color(0xffd9b8) }, // Soft peachy-orange at horizon
        offset: { value: 33 },
        exponent: { value: 0.5 } // Gentle gradient for sunrise
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, 85, -77); // Start at camera position
    sceneInstance.add(sky);

    // Create camera (will follow the bird)
    const cameraInstance = new THREE.PerspectiveCamera(
      60, // Slightly narrower FOV for less distortion
      window.innerWidth / window.innerHeight,
      0.1,
      10000 // 2x increased far plane to see distant mountains
    );
    // Initial position behind and above the birds (birds start at 0,60,0)
    cameraInstance.position.set(0, 85, -77);
    cameraInstance.lookAt(0, 60, -21); // Look at center of formation
    setCamera(cameraInstance);

    // Create renderer with high quality settings
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Better quality rendering
    containerRef.current.appendChild(renderer.domElement);
    
    // Set up post-processing with pencil effect
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(sceneInstance, cameraInstance);
    const pencilLinesPass = new PencilLinesPass(sceneInstance, cameraInstance, window.innerWidth, window.innerHeight);
    pencilLinesPass.renderToScreen = true;
    
    composer.addPass(renderPass);
    composer.addPass(pencilLinesPass);

    // Function to generate terrain height at any x, y coordinate
    const getTerrainHeight = (x, y) => {
      // Multi-layered noise for realistic rolling hills and mountains
      const baseHeight = 
        Math.sin(x * 0.002) * Math.cos(y * 0.002) * 25 +
        Math.sin(x * 0.005) * Math.cos(y * 0.005) * 18 +
        Math.sin(x * 0.008) * Math.cos(y * 0.008) * 12;
      
      // Add medium details for mountain variety
      const detail = 
        Math.sin(x * 0.015) * Math.cos(y * 0.015) * 10 +
        Math.sin(x * 0.03) * Math.cos(y * 0.03) * 6;
      
      // Add fine details for roughness
      const roughness = 
        Math.sin(x * 0.08) * Math.cos(y * 0.08) * 3 +
        Math.sin(x * 0.15) * Math.cos(y * 0.15) * 1.5;
      
      // Occasional valleys for rivers and lakes
      const valley1 = Math.abs(Math.sin(x * 0.002 + Math.PI * 0.3)) < 0.12 ? -6 : 0;
      const valley2 = Math.abs(Math.cos(y * 0.003 + Math.PI * 0.7)) < 0.10 ? -5 : 0;
      
      // Combine all layers
      let height = baseHeight + detail + roughness + valley1 + valley2;
      
      // Create more dramatic peaks using power function
      if (height > 15) {
        height = 15 + Math.pow((height - 15) * 0.5, 1.2);
      }
      
      // Ensure reasonable minimum height but allow for water bodies
      // Water level is at -2, so this allows for lakes and rivers
      height = Math.max(height, -8); // Minimum height allows some underwater areas
      
      // Raise base elevation so most land is above water (-2 level)
      return height + 5;
    };
    
    // Create terrain chunk with solid foundation
    const createTerrainChunk = (offsetZ, material) => {
      const chunkSize = 2000;
      const segments = 150; // Increased density for smoother terrain
      
      // Create a group to hold both the terrain surface and solid base
      const group = new THREE.Group();
      
      // Top surface with detailed terrain
      const topGeometry = new THREE.PlaneGeometry(chunkSize, chunkSize, segments, segments);
      const topVertices = topGeometry.attributes.position.array;
      
      for (let i = 0; i < topVertices.length; i += 3) {
        const x = topVertices[i];
        const y = topVertices[i + 1] + offsetZ; // Offset in world space
        
        topVertices[i + 2] = getTerrainHeight(x, y);
      }
      
      topGeometry.attributes.position.needsUpdate = true;
      topGeometry.computeVertexNormals();
      
      // Create solid base box underneath to fill from terrain surface down
      // This creates the "dirt" layer beneath the terrain
      const baseHeight = 600; // Very deep foundation
      const baseGeometry = new THREE.BoxGeometry(chunkSize + 200, chunkSize + 200, baseHeight);
      const baseMesh = new THREE.Mesh(baseGeometry, material);
      // Position so the TOP of the box is a bit below the lowest terrain to prevent glitching
      // Lowest terrain is around y=-3, so put top at y=-5 for a small gap
      baseMesh.rotation.x = -Math.PI / 2; // Rotate to match terrain orientation
      baseMesh.position.y = -5 - baseHeight / 2; // Top at y=-5, extends down to -605
      
      group.add(baseMesh);
      group.userData.topGeometry = topGeometry; // Store for disposal
      group.userData.baseGeometry = baseGeometry;
      
      return { group, topGeometry };
    };
    
    // Terrain chunk management
    const terrainChunks = [];
    const chunkSize = 2000;
    const chunkOverlap = 50; // Larger overlap to prevent gaps
    let lastChunkZ = -chunkSize * 2; // Start well behind the camera
    
    // Cloud management
    const clouds = [];
    const cloudsPerChunk = 8; // Number of clouds to generate per terrain chunk
    
    // Function to generate clouds for a chunk
    const generateCloudsForChunk = (chunkZ) => {
      const chunkClouds = [];
      
      for (let i = 0; i < cloudsPerChunk; i++) {
        // Random position within the chunk area
        const x = (Math.random() - 0.5) * chunkSize * 0.6; // Spread across width
        const y = 75 + Math.random() * 25; // Height between 75 and 100
        const z = chunkZ + (Math.random() - 0.5) * chunkSize * 0.8; // Position within chunk
        
        // Random size (Minecraft style - boxy and varied)
        const width = 18 + Math.random() * 20; // 18-38
        const height = 3 + Math.random() * 3; // 3-6 (flat)
        const depth = 12 + Math.random() * 15; // 12-27
        
        // Random slow speed
        const speed = 0.01 + Math.random() * 0.008; // 0.01-0.018
        
        // Create cloud group manually since we can't use React components here
        const cloudGroup = new THREE.Group();
        
        // Cloud material - white with transparency
        const material = new THREE.MeshBasicMaterial({ 
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
          fog: false
        });
        
        // Create main cloud body (flat box)
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainCloud = new THREE.Mesh(mainGeometry, material);
        cloudGroup.add(mainCloud);
        
        // Add 1-3 additional smaller boxes for Minecraft-style look
        const numParts = Math.floor(Math.random() * 3) + 1;
        const geometries = [mainGeometry];
        
        for (let j = 0; j < numParts; j++) {
          const partWidth = width * (0.3 + Math.random() * 0.4);
          const partHeight = height * (0.6 + Math.random() * 0.6);
          const partDepth = depth * (0.3 + Math.random() * 0.4);
          
          const partGeometry = new THREE.BoxGeometry(partWidth, partHeight, partDepth);
          const partMesh = new THREE.Mesh(partGeometry, material);
          
          // Position randomly around the main cloud
          partMesh.position.x = (Math.random() - 0.5) * width * 0.8;
          partMesh.position.y = (Math.random() - 0.5) * height;
          partMesh.position.z = (Math.random() - 0.5) * depth * 0.8;
          
          cloudGroup.add(partMesh);
          geometries.push(partGeometry);
        }
        
        // Set cloud position
        cloudGroup.position.set(x, y, z);
        
        // Add to scene
        sceneInstance.add(cloudGroup);
        
        // Store cloud data
        chunkClouds.push({
          group: cloudGroup,
          geometries: geometries,
          material: material,
          initialZ: z,
          speed: speed,
          startTime: performance.now()
        });
      }
      
      return chunkClouds;
    };
    
    // Create shader material for elevation-based coloring
    const terrainVertexShader = `
      varying vec3 vNormal;
      varying float vHeight;
      varying vec2 vUv;
      varying vec3 vPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vHeight = position.z;
        vUv = uv;
        vPosition = position.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const terrainFragmentShader = `
      uniform vec3 waterColor;
      uniform vec3 waterDeepColor;
      uniform vec3 grassColor;
      uniform vec3 rockColor;
      uniform vec3 snowColor;
      uniform vec3 lightDirection;
      uniform float time;
      
      varying vec3 vNormal;
      varying float vHeight;
      varying vec2 vUv;
      varying vec3 vPosition;
      
      // Simple noise function for water ripples
      float noise(vec2 p) {
        return sin(p.x * 10.0 + time) * cos(p.y * 10.0 + time * 0.8) * 0.5 + 0.5;
      }
      
      void main() {
        // Define elevation thresholds (lower water level for rivers/lakes only)
        float waterLevel = -2.0;
        float grassLevel = 8.0;
        float rockLevel = 25.0;
        float snowLevel = 40.0;
        
        vec3 color;
        
        // Blend between colors based on height
        if (vHeight < waterLevel) {
          // Animated water with waves and ripples (smaller pattern for scale)
          float wave1 = sin(vPosition.x * 0.05 + time * 0.3) * cos(vPosition.y * 0.05 + time * 0.25) * 0.3;
          float wave2 = sin(vPosition.x * 0.12 + time * 0.2) * cos(vPosition.y * 0.08 + time * 0.3) * 0.2;
          float ripple = noise(vUv * 100.0 + time * 0.1) * 0.1;
          
          float waveHeight = wave1 + wave2 + ripple;
          
          // Blend water colors based on depth and waves
          float depth = (waterLevel - vHeight) / waterLevel;
          vec3 baseWaterColor = mix(waterColor, waterDeepColor, depth * 0.5);
          
          // Add wave highlights
          float foam = smoothstep(waterLevel - 0.3, waterLevel - 0.1, vHeight + waveHeight);
          color = mix(baseWaterColor, vec3(0.9, 0.95, 1.0), foam * 0.3);
          
        } else if (vHeight < grassLevel) {
          float t = (vHeight - waterLevel) / (grassLevel - waterLevel);
          color = mix(grassColor, grassColor, t);
        } else if (vHeight < rockLevel) {
          float t = (vHeight - grassLevel) / (rockLevel - grassLevel);
          color = mix(grassColor, rockColor, t);
        } else if (vHeight < snowLevel) {
          float t = (vHeight - rockLevel) / (snowLevel - rockLevel);
          color = mix(rockColor, snowColor, t);
        } else {
          color = snowColor;
        }
        
        // Zelda-style lighting (brighter, more ambient)
        float lightIntensity = max(dot(vNormal, lightDirection), 0.5) + 0.3;
        
        // Water gets extra shine and sparkle
        if (vHeight < waterLevel) {
          float sparkle = noise(vUv * 50.0 + time * 0.4);
          lightIntensity = max(dot(vNormal, lightDirection), 0.6) + 0.5 + sparkle * 0.2;
        }
        
        color *= lightIntensity;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    const terrainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        waterColor: { value: new THREE.Color(0x4db8ff) }, // Zelda bright water blue
        waterDeepColor: { value: new THREE.Color(0x2266aa) }, // Deeper blue for depth
        grassColor: { value: new THREE.Color(0x84c43d) }, // Zelda vibrant yellow-green
        rockColor: { value: new THREE.Color(0xa08454) }, // Zelda earthy brown
        snowColor: { value: new THREE.Color(0xf5f0e8) }, // Warm light beige for peaks
        lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
        time: { value: 0.0 }
      },
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      side: THREE.DoubleSide,
      wireframe: false
    });
    
    // Create initial terrain chunks (5 chunks to cover initial view and beyond)
    for (let i = 0; i < 5; i++) {
      const offsetZ = lastChunkZ + chunkSize - chunkOverlap;
      const { group, topGeometry } = createTerrainChunk(offsetZ, terrainMaterial);
      
      // Add the top terrain surface to the group
      const topMesh = new THREE.Mesh(topGeometry, terrainMaterial);
      topMesh.rotation.x = -Math.PI / 2;
      group.add(topMesh);
      
      // Position the entire group
      group.position.y = 0;
      group.position.z = offsetZ;
      sceneInstance.add(group);
      
      terrainChunks.push({
        mesh: group,
        geometry: topGeometry,
        zPosition: offsetZ
      });
      
      // Generate clouds for this chunk
      const chunkClouds = generateCloudsForChunk(offsetZ);
      clouds.push(...chunkClouds);
      
      lastChunkZ = offsetZ;
    }
    
    // Add fog to create atmospheric haze at the horizon
    // Soft peachy sunrise fog
    sceneInstance.fog = new THREE.Fog(0xffe5cc, 1000, 5000);

    // Add early morning lighting with gentle sunrise warmth
    const ambientLight = new THREE.AmbientLight(0xfff0e0, 0.8);
    sceneInstance.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffe8c8, 1.1);
    directionalLight.position.set(5, 10, 5);
    sceneInstance.add(directionalLight);

    // Flight path configuration (must match Bird.js)
    const flightPath = {
      height: 60,
      speed: 0.05
    };
    
    // Animation loop for water waves and camera following
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update time uniform for water animation
      terrainMaterial.uniforms.time.value = performance.now() * 0.001;
      
      // Update camera to follow the bird formation
      const currentTime = performance.now();
      let flightTime = currentTime * flightPath.speed;
      
      // Calculate leader bird position (birds slow down forward as they turn upward)
      let leaderZ = flightTime;
      if (tiltStartTimeRef.current !== null) {
        const tiltElapsed = (currentTime - tiltStartTimeRef.current) * 0.001;
        const tiltProgress = Math.pow(tiltElapsed * 0.3, 2);
        
        // Birds reduce forward speed as they turn upward sharply
        const speedReduction = Math.max(0.3, 1 - (tiltProgress * 0.5));
        
        // Calculate distance traveled before turn started
        const distanceBeforeBoost = tiltStartTimeRef.current * flightPath.speed;
        
        // Calculate distance during upward turn with reduced forward speed
        const distanceDuringBoost = (currentTime - tiltStartTimeRef.current) * flightPath.speed * speedReduction;
        
        leaderZ = distanceBeforeBoost + distanceDuringBoost;
      }
      
      // Leader bird position (flying straight along Z axis)
      const leaderX = 0;
      const leaderY = flightPath.height;
      
      // Infinite terrain generation - create new chunks ahead, remove old chunks behind
      // Create new chunk if we're getting close to the last chunk
      if (leaderZ > lastChunkZ - chunkSize) {
        const offsetZ = lastChunkZ + chunkSize - chunkOverlap;
        const { group, topGeometry } = createTerrainChunk(offsetZ, terrainMaterial);
        
        // Add the top terrain surface to the group
        const topMesh = new THREE.Mesh(topGeometry, terrainMaterial);
        topMesh.rotation.x = -Math.PI / 2;
        group.add(topMesh);
        
        // Position the entire group
        group.position.y = 0;
        group.position.z = offsetZ;
        sceneInstance.add(group);
        
        terrainChunks.push({
          mesh: group,
          geometry: topGeometry,
          zPosition: offsetZ
        });
        
        // Generate clouds for the new chunk
        const chunkClouds = generateCloudsForChunk(offsetZ);
        clouds.push(...chunkClouds);
        
        lastChunkZ = offsetZ;
      }
      
      // Update cloud positions (they move slowly forward)
      clouds.forEach(cloud => {
        const elapsed = (currentTime - cloud.startTime) * cloud.speed;
        cloud.group.position.z = cloud.initialZ + elapsed;
      });
      
      // Remove old clouds that are far behind the camera
      while (clouds.length > 0 && clouds[0].group.position.z < leaderZ - chunkSize * 2) {
        const oldCloud = clouds.shift();
        sceneInstance.remove(oldCloud.group);
        oldCloud.geometries.forEach(geo => geo.dispose());
        oldCloud.material.dispose();
      }
      
      // Remove old chunks that are far behind the camera
      while (terrainChunks.length > 0 && terrainChunks[0].zPosition < leaderZ - chunkSize * 2) {
        const oldChunk = terrainChunks.shift();
        sceneInstance.remove(oldChunk.mesh);
        oldChunk.geometry.dispose();
        // Also dispose base geometry if it exists
        if (oldChunk.mesh.userData.baseGeometry) {
          oldChunk.mesh.userData.baseGeometry.dispose();
        }
      }
      
      // Position camera behind and above the center of the V formation
      const formationBackDistance = 60; // How far back the formation extends
      const cameraExtraDistance = 25; // Additional distance behind the formation
      const totalCameraDistance = formationBackDistance + cameraExtraDistance;
      const cameraHeight = 20; // Height above the formation
      
      // Camera positioned behind the formation (uses normal speed, not boosted)
      const cameraX = leaderX;
      const cameraZ = flightTime - totalCameraDistance; // Camera maintains constant speed
      let cameraY = leaderY + cameraHeight;
      
      // Look at the center of the formation
      const formationCenterDistance = formationBackDistance / 2;
      let lookX = leaderX;
      let lookY = leaderY;
      let lookZ = leaderZ - formationCenterDistance;
      
      // Apply tilt upward if space was pressed (exponential curve)
      if (tiltStartTimeRef.current !== null) {
        const tiltElapsed = (currentTime - tiltStartTimeRef.current) * 0.001; // Convert to seconds
        // Exponential curve: starts slow, accelerates upward
        const tiltProgress = Math.pow(tiltElapsed * 0.3, 2); // Exponential growth
        const maxTiltAngle = Math.PI / 3; // Maximum tilt angle (60 degrees)
        const tiltAmount = Math.min(tiltProgress, maxTiltAngle);
        
        // Camera movement with slight delay so it can see birds ascending
        const cameraDelay = 5.3; // 2.3 second delay
        const cameraTiltElapsed = Math.max(0, tiltElapsed - cameraDelay);
        const cameraTiltProgress = Math.pow(cameraTiltElapsed * 0.3, 2);
        
        // Move camera upward with delay (matches birds' dramatic upward speed)
        const upwardSpeed = 50; // Same dramatic upward speed as birds
        cameraY = leaderY + cameraHeight + (cameraTiltProgress * upwardSpeed);
        
        // Calculate the upward tilt by raising the look point (birds' position, not camera's)
        const distance = Math.sqrt(
          Math.pow(lookX - cameraX, 2) + 
          Math.pow(lookZ - cameraZ, 2)
        );
        lookY = leaderY + (tiltProgress * upwardSpeed) + Math.tan(tiltAmount) * distance;
      }
      
      cameraInstance.position.set(cameraX, cameraY, cameraZ);
      
      // Make sky follow the camera so it's always visible
      sky.position.copy(cameraInstance.position);
      
      cameraInstance.lookAt(lookX, lookY, lookZ);
      
      composer.render();
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      cameraInstance.aspect = window.innerWidth / window.innerHeight;
      cameraInstance.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      pencilLinesPass.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
      
      // Dispose all terrain chunks
      terrainChunks.forEach(chunk => {
        sceneInstance.remove(chunk.mesh);
        chunk.geometry.dispose();
        // Also dispose base geometry if it exists
        if (chunk.mesh.userData.baseGeometry) {
          chunk.mesh.userData.baseGeometry.dispose();
        }
      });
      
      // Dispose all clouds
      clouds.forEach(cloud => {
        sceneInstance.remove(cloud.group);
        cloud.geometries.forEach(geo => geo.dispose());
        cloud.material.dispose();
      });
      
      terrainMaterial.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      pencilLinesPass.dispose();
      renderer.dispose();
    };
  }, []);

  // Audio handling - start muted, unmute on any key or click
  useEffect(() => {
    const handleUnmute = () => {
      if (audioRef.current && !audioUnmuted) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1.0; // Ensure full volume at start
        audioRef.current.play().catch(err => console.log('Audio play failed:', err));
        setAudioUnmuted(true);
        
        // After unmute message fades out (1.5s) + delay (1s), show space message
        setTimeout(() => {
          setShowSpaceMessage(true);
        }, 2500); // 1.5s fade + 1s delay
      }
    };

    // Listen for any key press or click
    window.addEventListener('keydown', handleUnmute);
    window.addEventListener('click', handleUnmute);

    return () => {
      window.removeEventListener('keydown', handleUnmute);
      window.removeEventListener('click', handleUnmute);
    };
  }, [audioUnmuted]);

  // Space key handler - triggers tilt animation
  useEffect(() => {
    const handleSpace = (e) => {
      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
        tiltStartTimeRef.current = performance.now();
        
        // Fade out background river sound
        if (audioRef.current) {
          const fadeOutDuration = 2000; // 2 seconds
          const fadeSteps = 50;
          const stepTime = fadeOutDuration / fadeSteps;
          const volumeStep = audioRef.current.volume / fadeSteps;
          
          let currentStep = 0;
          const fadeInterval = setInterval(() => {
            if (currentStep >= fadeSteps || !audioRef.current) {
              clearInterval(fadeInterval);
              if (audioRef.current) {
                audioRef.current.volume = 0;
              }
            } else {
              audioRef.current.volume = Math.max(0, audioRef.current.volume - volumeStep);
              currentStep++;
            }
          }, stepTime);
        }
        
        // Play eagle sound as background fades
        if (eagleAudioRef.current) {
          eagleAudioRef.current.currentTime = 0; // Reset to start
          eagleAudioRef.current.play().catch(err => console.log('Eagle sound failed:', err));
        }
        
        // Show div after 4 seconds
        setTimeout(() => {
          setShowDiv(true);
        }, 4000);
      }
    };

    window.addEventListener('keydown', handleSpace);

    return () => {
      window.removeEventListener('keydown', handleSpace);
    };
  }, [spacePressed]);

  return (
    <>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }} />
      {scene && camera && (
        <>
          {/* Leader bird at the front of V */}
          <Bird scene={scene} position={[0, 25, 0]} tiltStartTimeRef={tiltStartTimeRef} flapDelay={0} />
          
          {/* Left side of V formation (8 birds) */}
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -4, z: -6, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={100} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -8, z: -12, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={200} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -12, z: -18, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={300} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -16, z: -24, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={400} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -20, z: -30, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={500} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -24, z: -36, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={600} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: -28, z: -42, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={700} />
          
          {/* Right side of V formation (7 birds) */}
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 4, z: -6, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={100} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 8, z: -12, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={200} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 12, z: -18, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={300} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 16, z: -24, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={400} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 20, z: -30, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={500} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 24, z: -36, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={600} />
          <Bird scene={scene} position={[0, 25, 0]} 
                offset={{ x: 28, z: -42, angle: 0 }} tiltStartTimeRef={tiltStartTimeRef} flapDelay={700} />
        </>
      )}
      
      {/* Audio elements */}
      <audio 
        ref={audioRef}
        src="/river.mp3"
        loop
        autoPlay
        muted
        preload="auto"
      />
      <audio 
        ref={eagleAudioRef}
        src="/eagle-soundbite.mp3"
        preload="auto"
      />
      
      {/* Freedom logo at top center */}
 
      
      {/* Unmute indicator - fades out after audio is unmuted */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        animation: audioUnmuted ? 'fadeOut 1.5s ease-out forwards' : 'pulse 2s infinite',
        cursor: 'pointer',
        pointerEvents: audioUnmuted ? 'none' : 'auto'
      }}>
        Click or press any key for sound
      </div>
      
      {/* Press Space to Begin - centered caption at bottom */}
      {showSpaceMessage && (
        <p style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '18px',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          margin: 0,
          zIndex: 1000,
          textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          WebkitTextStroke: '0.5px black',
          animation: spacePressed ? 'fadeOut 1.5s ease-out forwards' : 'fadeIn 2s ease-in',
          letterSpacing: '0.5px',
          pointerEvents: 'none'
        }}>
          Press Space to See Truth
        </p>
      )}
      
      {/* Div that appears 4 seconds after space is pressed */}
      {showDiv && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          background: 'white',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          zIndex: 2000,
          animation: 'fadeIn 1s ease-in'
        }}>
          Gratitude
        </div>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
