import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Google Fonts - Rounded Mplus 1c */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rounded+Mplus+1c:wght@100;300;400;500;700;800;900&display=swap" rel="stylesheet" />
        
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/LogoA.png" />
        <link rel="apple-touch-icon" href="/LogoA.png" />
        
        {/* Primary Meta Tags */}
        <meta name="title" content="Amiigos - Build Games Together, Meet in Real Life" />
        <meta name="description" content="Build a multiplayer game with an online friend for 100 hours, and Hack Club will help fund your flight to meet them in real life. Spend a week living with your friend in their hometown, creating deep connections through collaborative game development and real-world adventures." />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Amiigos - Build Games Together, Meet in Real Life" />
        <meta property="og:description" content="Build a multiplayer game with an online friend for 100 hours, and Hack Club will help fund your flight to meet them in real life. Spend a week living with your friend in their hometown, creating deep connections through collaborative game development and real-world adventures." />
        <meta property="og:image" content="/LogoA.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="Amiigos - Build Games Together, Meet in Real Life" />
        <meta property="twitter:description" content="Build a multiplayer game with an online friend for 100 hours, and Hack Club will help fund your flight to meet them in real life. Spend a week living with your friend in their hometown, creating deep connections through collaborative game development and real-world adventures." />
        <meta property="twitter:image" content="/LogoA.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
