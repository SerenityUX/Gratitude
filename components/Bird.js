import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';

export default function Bird({ scene, position = [0, 25, 0], offset = { x: 0, z: 0, angle: 0 }, tiltStartTimeRef = null, flapDelay = 0 }) {
  const birdRef = useRef(null);
  const leftWingRef = useRef(null);
  const rightWingRef = useRef(null);
  const flightPathRef = useRef({ 
    height: 60, // Fixed high altitude
    speed: 0.05 // Forward speed
  });

  useEffect(() => {
    if (!scene) return;

    // Create a simple bird shape (line with two diagonals for wings)
    const birdGroup = new THREE.Group();

    // Create white outline material (thicker, behind)
    const outlineMaterial = new LineMaterial({ 
      color: 0xffffff,
      linewidth: 9, // Thicker for outline effect
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      worldUnits: false
    });

    // Create black line material (on top)
    const material = new LineMaterial({ 
      color: 0x000000,
      linewidth: 5, // Thickness in pixels
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      worldUnits: false
    });

    // Body outline (white, behind)
    const bodyOutlineGeometry = new LineGeometry();
    bodyOutlineGeometry.setPositions([
      0, 0, -1.5, // Back
      0, 0, 1.5   // Front (nose)
    ]);
    const bodyOutline = new Line2(bodyOutlineGeometry, outlineMaterial);
    bodyOutline.renderOrder = 0;
    birdGroup.add(bodyOutline);

    // Body (black line on top)
    const bodyGeometry = new LineGeometry();
    bodyGeometry.setPositions([
      0, 0, -1.5, // Back
      0, 0, 1.5   // Front (nose)
    ]);
    const body = new Line2(bodyGeometry, material);
    body.renderOrder = 1;
    birdGroup.add(body);

    // Left wing outline (white, behind)
    const leftWingOutlineGeometry = new LineGeometry();
    leftWingOutlineGeometry.setPositions([
      0, 0, 0,
      -3, -1, -0.5
    ]);
    const leftWingOutline = new Line2(leftWingOutlineGeometry, outlineMaterial);
    leftWingOutline.renderOrder = 0;
    birdGroup.add(leftWingOutline);

    // Left wing (black line on top)
    const leftWingGeometry = new LineGeometry();
    leftWingGeometry.setPositions([
      0, 0, 0,
      -3, -1, -0.5
    ]);
    const leftWing = new Line2(leftWingGeometry, material);
    leftWing.renderOrder = 1;
    birdGroup.add(leftWing);
    leftWingRef.current = { 
      geometry: leftWingGeometry, 
      outlineGeometry: leftWingOutlineGeometry,
      line: leftWing,
      outlineLine: leftWingOutline
    };

    // Right wing outline (white, behind)
    const rightWingOutlineGeometry = new LineGeometry();
    rightWingOutlineGeometry.setPositions([
      0, 0, 0,
      3, -1, -0.5
    ]);
    const rightWingOutline = new Line2(rightWingOutlineGeometry, outlineMaterial);
    rightWingOutline.renderOrder = 0;
    birdGroup.add(rightWingOutline);

    // Right wing (black line on top)
    const rightWingGeometry = new LineGeometry();
    rightWingGeometry.setPositions([
      0, 0, 0,
      3, -1, -0.5
    ]);
    const rightWing = new Line2(rightWingGeometry, material);
    rightWing.renderOrder = 1;
    birdGroup.add(rightWing);
    rightWingRef.current = { 
      geometry: rightWingGeometry, 
      outlineGeometry: rightWingOutlineGeometry,
      line: rightWing,
      outlineLine: rightWingOutline
    };

    // Initial position
    birdGroup.position.set(position[0], position[1], position[2]);
    
    // Store reference
    birdRef.current = birdGroup;
    scene.add(birdGroup);

    // Animation loop for realistic wing flapping and flight path
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      const time = (currentTime + flapDelay) * 0.004; // Flapping speed with delay offset
      const flightTime = currentTime * flightPathRef.current.speed; // Movement speed
      
      // Create asymmetric flapping motion (downstroke vs upstroke)
      // Downstroke is more powerful and slower, upstroke is faster
      const cycle = time % (Math.PI * 2);
      let wingPhase;
      
      if (cycle < Math.PI * 1.2) {
        // Downstroke - slower, more powerful
        wingPhase = Math.sin(cycle / 1.2);
      } else {
        // Upstroke - faster
        wingPhase = -Math.sin((cycle - Math.PI * 1.2) / 0.8);
      }
      
      // Vertical movement (up/down)
      const yOffset = wingPhase * 1.2;
      
      // Forward/back movement (figure-8 pattern)
      // Wings sweep forward on downstroke, back on upstroke
      const zOffset = Math.cos(time) * 0.4;
      
      // Wing spread (wings extend more on downstroke)
      const spread = 1 + (wingPhase * 0.3);
      
      // Update left wing (both outline and main line)
      if (leftWingRef.current) {
        const positions = [
          0, 0, 0,
          -3 * spread, -1 + yOffset, zOffset
        ];
        leftWingRef.current.geometry.setPositions(positions);
        leftWingRef.current.outlineGeometry.setPositions(positions);
      }
      
      // Update right wing (both outline and main line)
      if (rightWingRef.current) {
        const positions = [
          0, 0, 0,
          3 * spread, -1 + yOffset, zOffset
        ];
        rightWingRef.current.geometry.setPositions(positions);
        rightWingRef.current.outlineGeometry.setPositions(positions);
      }
      
      // Update bird position - straight flight path at constant altitude
      if (birdRef.current) {
        const { height, speed } = flightPathRef.current;
        
        // Move straight forward along Z axis using flightTime
        let distance = flightTime;
        
        // Apply formation offset
        const x = offset.x;
        let y = height;
        
        // Apply upward tilt if space was pressed (exponential curve)
        let rotationX = 0; // Default rotation (level flight)
        if (tiltStartTimeRef && tiltStartTimeRef.current !== null) {
          const tiltElapsed = (currentTime - tiltStartTimeRef.current) * 0.001; // Convert to seconds
          // Exponential curve for upward flight
          const tiltProgress = Math.pow(tiltElapsed * 0.3, 2);
          
          // Dramatically increase upward speed - exponential ascent
          const upwardSpeed = 150; // Much faster ascent
          y = height + (tiltProgress * upwardSpeed);
          
          // Reduce forward speed as birds turn upward (like climbing steeply)
          const speedReduction = Math.max(0.3, 1 - (tiltProgress * 0.5)); // Slow down forward movement
          
          // Calculate distance with reduced forward speed
          const distanceBeforeBoost = tiltStartTimeRef.current * speed;
          const distanceDuringBoost = (currentTime - tiltStartTimeRef.current) * speed * speedReduction;
          
          distance = distanceBeforeBoost + distanceDuringBoost;
          
          // Rotate birds upward more sharply with exponential curve
          const maxRotation = Math.PI / 2.2; // Steeper angle (about 80 degrees upward)
          rotationX = -Math.min(tiltProgress, maxRotation); // Negative for upward pitch
        }
        
        const z = distance + offset.z;
        birdRef.current.position.set(x, y, z);
        
        // Apply rotations
        birdRef.current.rotation.y = 0; // Facing forward
        birdRef.current.rotation.x = rotationX; // Pitch up when tilting
      }
    };
    animate();

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (birdRef.current) {
        scene.remove(birdRef.current);
        // Dispose geometries
        bodyGeometry.dispose();
        bodyOutlineGeometry.dispose();
        leftWingGeometry.dispose();
        leftWingOutlineGeometry.dispose();
        rightWingGeometry.dispose();
        rightWingOutlineGeometry.dispose();
        // Dispose materials
        material.dispose();
        outlineMaterial.dispose();
      }
    };
  }, [scene, position]);

  return null;
}
