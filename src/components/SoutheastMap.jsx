import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/SoutheastMap.css';

export default function SoutheastMap({ onBackToToolsHub }) {
  const [activeTab, setActiveTab] = useState('statewide');

  useEffect(() => {
  // Initialize statewide map
  const mapElement = document.getElementById('southeast-map');
  if (mapElement && !mapElement._leaflet_id) {
    const map = L.map('southeast-map').setView([56.5, -131.5], 6);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    return () => {
      if (map) map.remove();
    };
  }
}, [activeTab]);

useEffect(() => {
  // Load Tableau script for both tabs
  const script = document.createElement('script');
  script.src = 'https://public.tableau.com/javascripts/api/viz_v1.js';
  document.body.appendChild(script);
  
  return () => {
    if (document.body.contains(script)) {
      document.body.removeChild(script);
    }
  };
}, [activeTab]);

  return (
    <div className="southeast-map-container">
      {/* Background gradient */}
      <div className="southeast-map-background"></div>

      {/* Main Content */}
      <div className="southeast-map-content">
        {/* Header */}
        <div className="southeast-map-header">
          <button
            className="back-button-southeast"
            onClick={onBackToToolsHub}
            title="Back to Tools Hub"
          >
            ← Back
          </button>

          <div className="header-text-section">
            <div className="tab-container">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'statewide' ? 'active' : ''}`}
              onClick={() => setActiveTab('statewide')}
            >
              Statewide Data
            </button>
            <button
              className={`tab-button ${activeTab === 'southeast' ? 'active' : ''}`}
              onClick={() => setActiveTab('southeast')}
            >
              Southeast Data - Area A
            </button>
          </div>
        </div>
          </div>
        </div>

        {/* Tab Navigation */}
       

        {/* Tab Content */}
        <div className="tab-content-wrapper">
          {activeTab === 'statewide' && (
            <div className="tab-content statewide-content">
              <div className="content-split">
                {/* Map Container */}
                <div className="split-item map-item">
                  <div id="southeast-map" className="southeast-map"></div>
                </div>

                {/* Tableau Dashboard Container */}
                <div className="split-item tableau-item">
                  <div className='tableauPlaceholder' id='viz1763503351809' style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <noscript>
                      <a href='#'>
                        <img alt='Salmon Data Dashboard ' src='https://public.tableau.com/static/images/Al/AlaskaSalmonDataDashboard/SalmonDataDashboard/1_rss.png' style={{ border: 'none' }} />
                      </a>
                    </noscript>
                    <object className='tableauViz' style={{ display: 'none' }}>
                      <param name='host_url' value='https%3A%2F%2Fpublic.tableau.com%2F' />
                      <param name='embed_code_version' value='3' />
                      <param name='site_root' value='' />
                      <param name='name' value='AlaskaSalmonDataDashboard&#47;SalmonDataDashboard' />
                      <param name='tabs' value='no' />
                      <param name='toolbar' value='yes' />
                      <param name='static_image' value='https://public.tableau.com/static/images/Al/AlaskaSalmonDataDashboard/SalmonDataDashboard/1.png' />
                      <param name='animate_transition' value='yes' />
                      <param name='display_static_image' value='yes' />
                      <param name='display_spinner' value='yes' />
                      <param name='display_overlay' value='yes' />
                      <param name='display_count' value='yes' />
                      <param name='language' value='en-US' />
                    </object>
                  </div>
                  <script type='text/javascript'>
                    {`
                      var divElement = document.getElementById('viz1763503351809');
                      if (divElement) {
                        var vizElement = divElement.getElementsByTagName('object')[0];
                        if ( divElement.offsetWidth > 800 ) {
                          vizElement.style.minWidth='420px';
                          vizElement.style.maxWidth='100%';
                          vizElement.style.width='100%';
                          vizElement.style.minHeight='587px';
                          vizElement.style.maxHeight='100%';
                          vizElement.style.height=(divElement.offsetWidth*0.75)+'px';
                        } else if ( divElement.offsetWidth > 500 ) {
                          vizElement.style.minWidth='420px';
                          vizElement.style.maxWidth='100%';
                          vizElement.style.width='100%';
                          vizElement.style.minHeight='587px';
                          vizElement.style.maxHeight='100%';
                          vizElement.style.height=(divElement.offsetWidth*0.75)+'px';
                        } else {
                          vizElement.style.width='100%';
                          vizElement.style.height='827px';
                        }
                      }
                    `}
                  </script>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'southeast' && (
            <div className="tab-content southeast-content">
              <div className="content-split-vertical">
                {/* Map Container - ArcGIS Embed */}
                <div className="split-item map-item">
                  <iframe 
                    src="https://arcg.is/1Knnfu0"
                    className="southeast-map-alt"
                    style={{ border: 'none' }}
                    title="ArcGIS Map Viewer"
                    allowFullScreen
                  />
                </div>

                {/* Right Side - Dashboards Stacked */}
                <div className="dashboards-column">
                  {/* First Dashboard Container */}
                  <div className="split-item tableau-item" style={{height: '550px'}}> 
                    <div className='tableauPlaceholder' id='viz1763667574911' style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <noscript>
                        <a href='#'>
                          <img alt='Number of Salmon Caught by Fishery (SEAK)' src='https://public.tableau.com/static/images/SE/SEAKSalmonbyarea/SEAKSalmonbyArea/1_rss.png' style={{ border: 'none' }} />
                        </a>
                        </noscript>
                      <object className='tableauViz' style={{ display: 'none' }}>
                        <param name='host_url' value='https%3A%2F%2Fpublic.tableau.com%2F' />
                        <param name='embed_code_version' value='3' />
                        <param name='site_root' value='' />
                        <param name='name' value='SEAKSalmonbyarea&#47;SEAKSalmonbyArea' />
                        <param name='tabs' value='no' />
                        <param name='toolbar' value='yes' />
                        <param name='static_image' value='https://public.tableau.com/static/images/SE/SEAKSalmonbyarea/SEAKSalmonbyArea/1.png' />
                        <param name='animate_transition' value='yes' />
                        <param name='display_static_image' value='yes' />
                        <param name='display_spinner' value='yes' />
                        <param name='display_overlay' value='yes' />
                        <param name='display_count' value='yes' />
                        <param name='language' value='en-US' />
                        <param name='filter' value='publish=yes' />
                      </object>
                    </div>
                    <script type='text/javascript'>
                      {`
                        var divElement = document.getElementById('viz1763667574911');
                        var vizElement = divElement.getElementsByTagName('object')[0];
                        vizElement.style.width='100%';
                        vizElement.style.height=(divElement.offsetWidth*0.75)+'px';
                        var scriptElement = document.createElement('script');
                        scriptElement.src = 'https://public.tableau.com/javascripts/api/viz_v1.js';
                        vizElement.parentNode.insertBefore(scriptElement, vizElement);
                      `}
                    </script>
                  </div>

                  {/* Second Dashboard Container */}
                  <div className="split-item tableau-item" style={{height: '500px'}}>
                    <div className='tableauPlaceholder' id='viz1763667608060' style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <noscript>
                        <a href='#'>
                          <img alt='Average Price ($) of Sockeye per Fishery Area (SEAK)' src='https://public.tableau.com/static/images/SE/SEAKSalmonbyarea/SEAKSalmonPriceWeightbyArea/1_rss.png' style={{ border: 'none' }} />
                        </a>
                      </noscript>
                      <object className='tableauViz' style={{ display: 'none' }}>
                        <param name='host_url' value='https%3A%2F%2Fpublic.tableau.com%2F' />
                        <param name='embed_code_version' value='3' />
                        <param name='site_root' value='' />
                        <param name='name' value='SEAKSalmonbyarea&#47;SEAKSalmonPriceWeightbyArea' />
                        <param name='tabs' value='no' />
                        <param name='toolbar' value='yes' />
                        <param name='static_image' value='https://public.tableau.com/static/images/SE/SEAKSalmonbyarea/SEAKSalmonPriceWeightbyArea/1.png' />
                        <param name='animate_transition' value='yes' />
                        <param name='display_static_image' value='yes' />
                        <param name='display_spinner' value='yes' />
                        <param name='display_overlay' value='yes' />
                        <param name='display_count' value='yes' />
                        <param name='language' value='en-US' />
                        <param name='filter' value='publish=yes' />
                      </object>
                    </div>
                    <script type='text/javascript'>
                      {`
                        var divElement = document.getElementById('viz1763667608060');
                        var vizElement = divElement.getElementsByTagName('object')[0];
                        vizElement.style.width='100%';
                        vizElement.style.height=(divElement.offsetWidth*0.75)+'px';
                        var scriptElement = document.createElement('script');
                        scriptElement.src = 'https://public.tableau.com/javascripts/api/viz_v1.js';
                        vizElement.parentNode.insertBefore(scriptElement, vizElement);
                      `}
                    </script>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}