import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createPlayer } from './Player';

export default function ThreeDScene() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanupFunctions = [];
    
    // Wait for next frame to ensure container is sized
    const frameId = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      
      // Get container dimensions
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      console.log('Container dimensions:', containerWidth, 'x', containerHeight);
      
      // Don't proceed if container has no size
      if (containerWidth === 0 || containerHeight === 0) {
        console.error('Container has no dimensions!');
        return;
      }

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x808080); // Grey sky
      
      // Add fog for max render distance effect
      const maxRenderDistance = 40; // Distance where objects fade out completely
      scene.fog = new THREE.Fog(0x808080, maxRenderDistance * 0.5, maxRenderDistance);

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        75,
        containerWidth / containerHeight,
        0.1,
        1000
      );
      camera.position.set(0, 5, 5); // Position above and behind
      camera.lookAt(0, 0.5, 0); // Look at the cube

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerWidth, containerHeight);
      renderer.domElement.style.cursor = 'grab'; // Set initial cursor
      renderer.domElement.style.display = 'block'; // Prevent extra spacing
      containerRef.current.appendChild(renderer.domElement);
      
      console.log('Canvas created:', renderer.domElement.width, 'x', renderer.domElement.height);

      // Load texture for ground plane
      const textureLoader = new THREE.TextureLoader();
      const groundTexture = textureLoader.load(
        '/GroundTile.png',
        // onLoad callback
        (texture) => {
          console.log('Texture loaded successfully');
          renderer.render(scene, camera);
        },
        // onProgress callback
        undefined,
        // onError callback
        (error) => {
          console.error('Error loading texture:', error);
        }
      );
      
      // Set up mirrored repeat wrapping for alternating flip pattern
      groundTexture.wrapS = THREE.MirroredRepeatWrapping;
      groundTexture.wrapT = THREE.MirroredRepeatWrapping;
      groundTexture.repeat.set(15, 15); // Tile 15x15 times (tiles are 50% larger = fewer repetitions)
      
      // Dark ground plane with texture (much larger)
      const planeGeometry = new THREE.PlaneGeometry(50, 50);
      const planeMaterial = new THREE.MeshBasicMaterial({
        map: groundTexture,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
      scene.add(plane);

      // Create multiple players at random positions
      const numPlayers = 10;
      const players = [];
      const planeSize = 50;
      
      for (let i = 0; i < numPlayers; i++) {
        // Random position within the plane, avoiding edges
        const x = (Math.random() - 0.5) * (planeSize - 10);
        const z = (Math.random() - 0.5) * (planeSize - 10);
        
        const player = createPlayer(x, z);
        players.push(player);
        scene.add(player.mesh);
      }

      // Raycaster for hover detection
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      // Map-style drag controls with momentum and acceleration
      let isDragging = false;
      let selectedPlayerIndex = -1; // Track which player is selected
      let hoveredPlayerIndex = -1; // Track which player is being hovered
      let previousMousePosition = { x: 0, y: 0 };
      let velocity = { x: 0, z: 0 };
      let targetVelocity = { x: 0, z: 0 };
      const basePanSpeed = 0.005; // Much slower base speed
      const acceleration = 0.15; // How quickly it reaches target speed
      const friction = 0.95; // Smoother drift
      
      // Camera follow settings
      const cameraFollowSpeed = 0.003; // Constant speed for camera movement (slower)
      const cameraOffset = { x: 0, y: 5, z: 5 }; // Camera offset from player

      const onMouseDown = (e) => {
        console.log('Mouse down event');
        // Get mouse position relative to the renderer canvas
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        // Check all players for intersection (get closest one)
        const playerMeshes = players.map(p => p.mesh);
        const intersects = raycaster.intersectObjects(playerMeshes, false);
        
        let clickedPlayerIndex = -1;
        if (intersects.length > 0) {
          // Find which player was clicked (closest one)
          const clickedMesh = intersects[0].object;
          clickedPlayerIndex = players.findIndex(p => p.mesh === clickedMesh);
        }
        
        if (clickedPlayerIndex !== -1) {
          // Clicked on a player - toggle selection
          if (selectedPlayerIndex === clickedPlayerIndex) {
            // Deselect current player
            players[selectedPlayerIndex].setSelected(false);
            selectedPlayerIndex = -1;
          } else {
            // Deselect previous player if any
            if (selectedPlayerIndex !== -1) {
              players[selectedPlayerIndex].setSelected(false);
            }
            // Select new player
            selectedPlayerIndex = clickedPlayerIndex;
            players[selectedPlayerIndex].setSelected(true);
          }
          return; // Don't start dragging
        }
        
        // Normal drag behavior (also deselect any selected player)
        if (selectedPlayerIndex !== -1) {
          players[selectedPlayerIndex].setSelected(false);
          selectedPlayerIndex = -1;
        }
        
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        velocity = { x: 0, z: 0 }; // Stop drift when grabbing
        targetVelocity = { x: 0, z: 0 };
        renderer.domElement.style.cursor = 'grabbing';
      };

      const onMouseMove = (e) => {
        // Get mouse position relative to the renderer canvas
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (isDragging) {
          const deltaX = e.clientX - previousMousePosition.x;
          const deltaY = e.clientY - previousMousePosition.y;

          // Set target velocity based on mouse movement
          targetVelocity.x = -deltaX * basePanSpeed;
          targetVelocity.z = -deltaY * basePanSpeed;

          previousMousePosition = { x: e.clientX, y: e.clientY };
        } else {
          // Check for hover when not dragging
          raycaster.setFromCamera(mouse, camera);
          
          // Check all players for hover (get closest one)
          const playerMeshes = players.map(p => p.mesh);
          const intersects = raycaster.intersectObjects(playerMeshes, false);
          
          if (intersects.length > 0) {
            // Find which player is being hovered (closest one)
            const hoveredMesh = intersects[0].object;
            hoveredPlayerIndex = players.findIndex(p => p.mesh === hoveredMesh);
            renderer.domElement.style.cursor = 'pointer';
          } else {
            hoveredPlayerIndex = -1;
            renderer.domElement.style.cursor = 'grab';
          }
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        renderer.domElement.style.cursor = 'grab';
      };

      // Scroll to pan, pinch to zoom
      const onWheel = (e) => {
        e.preventDefault();
        
        // Detect pinch gesture (ctrlKey is set on trackpad pinch)
        if (e.ctrlKey) {
          // Zoom with FOV on pinch
          const zoomSpeed = 0.1;
          camera.fov += e.deltaY * zoomSpeed;
          camera.fov = Math.max(20, Math.min(100, camera.fov)); // Clamp between 20-100
          camera.updateProjectionMatrix();
        } else {
          // Pan camera with scroll (slower)
          const scrollSpeed = 0.02;
          const scrolledX = e.deltaX * scrollSpeed;
          const scrolledY = e.deltaY * scrollSpeed;
          
          if (Math.abs(scrolledX) > 0 || Math.abs(scrolledY) > 0) {
            // Only allow scrolling if no player is selected
            if (selectedPlayerIndex === -1) {
              camera.position.x += scrolledX;
              camera.position.z += scrolledY;
            } else {
              // Auto-deselect player when trying to scroll with player selected
              players[selectedPlayerIndex].setSelected(false);
              selectedPlayerIndex = -1;
              camera.position.x += scrolledX;
              camera.position.z += scrolledY;
            }
          }
          
          // Reset velocity when scrolling
          velocity = { x: 0, z: 0 };
          targetVelocity = { x: 0, z: 0 };
        }
      };

      console.log('Attaching event listeners to canvas');
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('mouseleave', onMouseUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      // Animation loop for smooth drift and acceleration
      const clock = new THREE.Clock();
      let animationId;
      
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        const deltaTime = clock.getDelta();

        if (isDragging) {
          // Smoothly accelerate towards target velocity
          velocity.x += (targetVelocity.x - velocity.x) * acceleration;
          velocity.z += (targetVelocity.z - velocity.z) * acceleration;
        } else {
          // Apply friction when not dragging
          velocity.x *= friction;
          velocity.z *= friction;

          // Stop drift if velocity is very small
          if (Math.abs(velocity.x) < 0.0001) velocity.x = 0;
          if (Math.abs(velocity.z) < 0.0001) velocity.z = 0;
        }

        // Check if camera is moving
        const isMoving = Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.z) > 0.0001;

        // Apply velocity to camera (removed camera following functionality)
        if (isMoving) {
          camera.position.x += velocity.x;
          camera.position.z += velocity.z;
        }

        // Update all players with collision avoidance and distance culling
        for (let i = 0; i < players.length; i++) {
          const isSelected = i === selectedPlayerIndex;
          const isHovered = i === hoveredPlayerIndex;
          
          // Distance-based culling for performance
          const dx = players[i].mesh.position.x - camera.position.x;
          const dz = players[i].mesh.position.z - camera.position.z;
          const distanceToCamera = Math.sqrt(dx * dx + dz * dz);
          
          // Hide players beyond max render distance
          players[i].mesh.visible = distanceToCamera <= maxRenderDistance;
          
          // Only update visible players (or selected player)
          if (players[i].mesh.visible || isSelected) {
            // Get all other players for collision avoidance
            const otherPlayers = players.filter((_, index) => index !== i);
            players[i].update(deltaTime, planeSize, isSelected, otherPlayers, isHovered);
          }
        }

        renderer.render(scene, camera);
      };
      animate();

      // Handle window resize
      const handleResize = () => {
        if (!containerRef.current) return;
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };
      window.addEventListener('resize', handleResize);

      // Store cleanup function
      cleanupFunctions.push(() => {
        console.log('Cleaning up 3D scene');
        if (animationId) cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('mouseleave', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
        planeGeometry.dispose();
        planeMaterial.dispose();
        groundTexture.dispose();
        
        // Dispose all players
        players.forEach(player => {
          player.geometry.dispose();
          player.material.dispose();
        });
        
        renderer.dispose();
      });
    });

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      cleanupFunctions.forEach(fn => fn());
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
