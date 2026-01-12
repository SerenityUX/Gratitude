export default function WelcomeUI() {
  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: '16px',
      width: 'calc(100vw - 32px)',
      height: 'calc(100vh - 32px)',
      background: 'white',
      borderRadius: '4px',
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
  );
}
