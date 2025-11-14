import { useEffect, useRef } from 'react';

export default function HtmlOverlay({ htmlContent, onNavigateToApp }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Define the navigation function on window
    window.navigateToApp = function() {
      onNavigateToApp?.();
    };
  }, [onNavigateToApp]);

  useEffect(() => {
    if (htmlContent && containerRef.current) {
      // Replace the onclick handlers with our function
      const modifiedHtml = htmlContent.replace(
        /onclick="window\.location\.href='#app'"/g,
        'onclick="window.navigateToApp()"'
      );

      containerRef.current.innerHTML = modifiedHtml;
    }
  }, [htmlContent]);

  return (
    <div 
      ref={containerRef}
      style={{ marginTop: '100vh' }}
    />
  );
}