import { useState, useEffect } from 'react';
import ThreeDScene from './3DScene';

export default function MainUI() {
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // Play gameStart.mp3 when MainUI opens
    const gameStartAudio = new Audio('/gameStart.mp3');
    gameStartAudio.play().catch(err => console.log('Audio playback failed:', err));
  }, []);

  useEffect(() => {
    // Show overlay after 2 seconds
    const timer = setTimeout(() => {
      setShowOverlay(true);
      // Play Home.mp3 when overlay appears
      const audio = new Audio('/Home.mp3');
      audio.play().catch(err => console.log('Audio playback failed:', err));
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: '16px',
      width: 'calc(100vw - 32px)',
      height: 'calc(100vh - 32px)',
      borderRadius: '6px',
      border: '2px solid #999999',
      overflow: 'hidden',
      zIndex: 100000,
      animation: 'fadeIn 1s ease-in',
      pointerEvents: 'auto',
      background: 'white'
    }}>
      <ThreeDScene />
      
      {/* Glass blur overlay that appears after 2 seconds */}
      {showOverlay && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.5s ease-in'
        }}>
          {/* White card container */}
          <div style={{
            backgroundColor: 'white',
            border: '2px solid #666666',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            width: '415px',
            maxWidth: '90%',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Background Logo */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '0px',
              pointerEvents: 'none'
            }}>
              <img 
                src="/AmiigoLowOpacity.svg" 
                alt="Amiigo Background" 
                style={{
                  width: '409px',
                  height: 'auto',
                  maxWidth: '100%'
                }}
              />
            </div>

            {/* Logo and Welcome text */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '30px 20px 20px',
              position: 'relative',
              zIndex: 1
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: '900',
                color: 'black',
                textAlign: 'center'
              }}>
                Welcome to Amiigo
              </div>
            </div>
            
            {/* Top divider line */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '0 27px'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '361px',
                height: '0',
                borderTop: '2px dotted #36a2d7',
                margin: '0 0 20px 0'
              }} />
            </div>
            
            {/* Three steps with icons */}
            <div style={{
              padding: '0 27px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              zIndex: 1
            }}>
              {/* Step 1 - Clock */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <img 
                  src="/ClockIcon.svg" 
                  alt="Clock" 
                  style={{
                    width: '26px',
                    height: '26px',
                    flexShrink: 0
                  }}
                />
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'black',
                  margin: 0,
                  lineHeight: '1.4',
                  flex: 1
                }}>
                  Spend 100 hours making a multiplayer game with your online friend
                </p>
              </div>
              
              {/* Step 2 - Plane */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <img 
                  src="/PlaneIcon.svg" 
                  alt="Plane" 
                  style={{
                    width: '26px',
                    height: '26px',
                    flexShrink: 0
                  }}
                />
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'black',
                  margin: 0,
                  lineHeight: '1.4',
                  flex: 1
                }}>
                  Get a flight stipend to go visit your online friend in their hometown
                </p>
              </div>
              
              {/* Step 3 - Video */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <img 
                  src="/VideoIcon.svg" 
                  alt="Video" 
                  style={{
                    width: '26px',
                    height: '26px',
                    flexShrink: 0
                  }}
                />
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'black',
                  margin: 0,
                  lineHeight: '1.4',
                  flex: 1
                }}>
                  Film a video sharing your adventure and the project you built together
                </p>
              </div>
            </div>
            
            {/* Bottom divider line */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '20px 27px 0'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '361px',
                height: '0',
                borderTop: '2px dotted #36a2d7',
                margin: 0
              }} />
            </div>
            
            {/* Email input and button container */}
            <div style={{
              padding: '20px 27px 23px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              zIndex: 1
            }}>
               <div style={{
                 border: '1px solid #666666',
                 borderRadius: '8px',
                 height: '47px',
                 display: 'flex',
                 alignItems: 'center',
                 position: 'relative'
               }}>
                <input
                  type="email"
                  placeholder="Your Email Address"
                  autoFocus
                  style={{
                    border: 'none',
                    outline: 'none',
                    padding: '0 130px 0 12px',
                    fontSize: '14px',
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    flex: 1
                  }}
                />
                 <button style={{
                   position: 'absolute',
                   right: '5px',
                   height: '37px',
                   width: '115px',
                   background: 'linear-gradient(to bottom, #36a2d7, #62c6f6)',
                   border: '1px solid #666666',
                   borderRadius: '8px',
                   fontSize: '14px',
                   fontWeight: '800',
                   color: 'white',
                   cursor: 'pointer',
                   transition: 'all 0.2s ease',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center'
                 }}>
                  Enter Amiigo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
