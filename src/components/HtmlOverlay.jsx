export default function HtmlOverlay({ htmlContent }) {
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{ marginTop: '100vh' }}
    />
  );
}