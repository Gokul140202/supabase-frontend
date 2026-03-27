// src/utils/downloadFile.js
export async function downloadFile(url, fileName) {
  // URL valid check
  if (!url || url === '[]' || url === '' || 
      url === 'null' || url.startsWith('[')) {
    return { success: false, error: 'Invalid file URL' };
  }

  try {
    // Blob fetch பண்ணு — cross-origin download fix!
    const response = await fetch(url, { method: 'GET' });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Memory free பண்ணு
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    
    return { success: true };
  } catch (err) {
    // Fallback: new tab-ல் open
    window.open(url, '_blank', 'noreferrer');
    return { success: false, error: err.message };
  }
}