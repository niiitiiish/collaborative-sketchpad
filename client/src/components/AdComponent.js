import React, { useEffect } from 'react';
import { Box } from '@mui/material';

const AdComponent = ({ adSlot, adFormat = 'auto', adStyle = {} }) => {
  useEffect(() => {
    // Load Google AdSense script
    const loadAdScript = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error('Error loading ad:', err);
      }
    };

    // Load the script if it hasn't been loaded yet
    if (!document.querySelector('script[src*="pagead2.googlesyndication.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    loadAdScript();
  }, []);

  return (
    <Box sx={{ 
      minHeight: '100px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      ...adStyle 
    }}>
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          ...adFormat === 'auto' ? { width: '100%', height: '100%' } : {}
        }}
        data-ad-client="ca-pub-YOUR_PUBLISHER_ID" // Replace with your AdSense publisher ID
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </Box>
  );
};

export default AdComponent; 