import * as THREE from 'three';

export function createPlayer(startX = 0, startZ = 0) {
  // Orange cube
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.set(startX, 0.5, startZ); // Position on the plane (y=0.5 to sit on top)
  
  // Movement properties
  let velocity = { x: 0, z: 0 };
  let targetDirection = { x: 0, z: 0 };
  let moveSpeed = 0.008; // Base walking speed
  let currentSpeed = 0;
  let targetSpeed = moveSpeed;
  
  // Time until next direction change
  let directionChangeTimer = Math.random() * 3 + 2; // 2-5 seconds
  
  // Idle/pause behavior
  let isPaused = false;
  let pauseTimer = 0;
  let timeSinceLastPause = Math.random() * 5 + 3; // Start with random delay
  
  // Rotation properties for humanoid movement
  let bobPhase = 0; // For up/down bob
  let tiltPhase = 0; // For side-to-side tilt
  
  // Choose a random initial direction
  const randomAngle = Math.random() * Math.PI * 2;
  targetDirection.x = Math.cos(randomAngle);
  targetDirection.z = Math.sin(randomAngle);
  
  // Function to update selection state
  const setSelected = (isSelected) => {
    if (isSelected) {
      cubeMaterial.color.setHex(0xff0000); // Red when selected
    } else {
      cubeMaterial.color.setHex(0xff6600); // Orange when not selected
    }
  };
  
  // Update movement (call this every frame)
  const update = (deltaTime, planeSize, isSelected, otherPlayers = [], isHovered = false) => {
    if (isSelected || isHovered) {
      // Completely stop moving when selected or hovered
      velocity.x = 0;
      velocity.z = 0;
      currentSpeed = 0;
      
      // Reset rotations to neutral
      cube.rotation.x *= 0.95;
      cube.rotation.z *= 0.95;
    } else {
      // Check for pause behavior
      if (isPaused) {
        pauseTimer -= deltaTime;
        if (pauseTimer <= 0) {
          // Resume movement
          isPaused = false;
          timeSinceLastPause = Math.random() * 8 + 5; // Wait 5-13 seconds before next pause
        }
        // Stop movement during pause
        currentSpeed *= 0.9;
        if (currentSpeed < 0.001) currentSpeed = 0;
      } else {
        timeSinceLastPause -= deltaTime;
        
        // Randomly pause
        if (timeSinceLastPause <= 0) {
          isPaused = true;
          pauseTimer = Math.random() * 2 + 1; // Pause for 1-3 seconds
        }
      }
      
      // Normal movement behavior
      directionChangeTimer -= deltaTime;
      
      // Check for collisions with other players
      const avoidanceDistance = 2.5; // Distance to start avoiding other players
      let needsToAvoid = false;
      let avoidDirection = { x: 0, z: 0 };
      
      for (const otherPlayer of otherPlayers) {
        const dx = cube.position.x - otherPlayer.mesh.position.x;
        const dz = cube.position.z - otherPlayer.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < avoidanceDistance && distance > 0.1) {
          needsToAvoid = true;
          // Move away from other player (weighted by how close they are)
          const weight = 1 - (distance / avoidanceDistance);
          avoidDirection.x += (dx / distance) * weight;
          avoidDirection.z += (dz / distance) * weight;
        }
      }
      
      // If avoiding, blend avoidance direction with current direction
      if (needsToAvoid) {
        const length = Math.sqrt(avoidDirection.x * avoidDirection.x + avoidDirection.z * avoidDirection.z);
        if (length > 0) {
          avoidDirection.x /= length;
          avoidDirection.z /= length;
          
          // Blend 70% avoidance with 30% current direction
          targetDirection.x = avoidDirection.x * 0.7 + targetDirection.x * 0.3;
          targetDirection.z = avoidDirection.z * 0.7 + targetDirection.z * 0.3;
          
          // Normalize
          const newLength = Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.z * targetDirection.z);
          targetDirection.x /= newLength;
          targetDirection.z /= newLength;
          
          directionChangeTimer = Math.max(directionChangeTimer, 0.5); // Check again soon
        }
      }
      
      // Change direction periodically or when near edge
      const margin = 3; // Start turning before hitting edge
      const needsToTurn = 
        (cube.position.x > planeSize / 2 - margin && targetDirection.x > 0) ||
        (cube.position.x < -planeSize / 2 + margin && targetDirection.x < 0) ||
        (cube.position.z > planeSize / 2 - margin && targetDirection.z > 0) ||
        (cube.position.z < -planeSize / 2 + margin && targetDirection.z < 0);
      
      if (directionChangeTimer <= 0 || needsToTurn) {
        // Choose new random direction
        if (needsToTurn) {
          // Turn away from edge
          const centerX = -cube.position.x;
          const centerZ = -cube.position.z;
          const length = Math.sqrt(centerX * centerX + centerZ * centerZ);
          targetDirection.x = centerX / length;
          targetDirection.z = centerZ / length;
          // Add some randomness
          const randomOffset = (Math.random() - 0.5) * 0.5;
          targetDirection.x += randomOffset;
          targetDirection.z += randomOffset;
        } else {
          const randomAngle = Math.random() * Math.PI * 2;
          targetDirection.x = Math.cos(randomAngle);
          targetDirection.z = Math.sin(randomAngle);
        }
        
        // Normalize direction
        const length = Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.z * targetDirection.z);
        targetDirection.x /= length;
        targetDirection.z /= length;
        
        directionChangeTimer = Math.random() * 3 + 2; // 2-5 seconds
      }
      
      // Smoothly accelerate to target speed (only if not paused)
      if (!isPaused) {
        currentSpeed += (targetSpeed - currentSpeed) * 0.05;
      }
      
      // Smoothly interpolate velocity towards target direction
      velocity.x += (targetDirection.x * currentSpeed - velocity.x) * 0.1;
      velocity.z += (targetDirection.z * currentSpeed - velocity.z) * 0.1;
    }
    
    // Apply velocity to position
    cube.position.x += velocity.x;
    cube.position.z += velocity.z;
    
    // Hard clamp to plane boundaries
    const halfSize = planeSize / 2 - 0.5; // Account for cube size
    cube.position.x = Math.max(-halfSize, Math.min(halfSize, cube.position.x));
    cube.position.z = Math.max(-halfSize, Math.min(halfSize, cube.position.z));
    
    // Humanoid-like movement animations
    if (currentSpeed > 0.001) {
      // Rotate to face movement direction
      const targetRotation = Math.atan2(velocity.x, velocity.z);
      const currentRotation = cube.rotation.y;
      let rotationDiff = targetRotation - currentRotation;
      
      // Normalize rotation difference to -PI to PI
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
      
      // Smoothly rotate towards target (slower rotation)
      cube.rotation.y += rotationDiff * 0.03;
    }
  };
  
  return { 
    mesh: cube, 
    geometry: cubeGeometry, 
    material: cubeMaterial, 
    setSelected,
    update
  };
}
