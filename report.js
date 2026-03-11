(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Simple bar chart
  function barChart(canvas, values, colorTop, colorBottom){
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const pad = 28; const w = (W - pad*2) / values.length; const max = Math.max(...values, 1);
    ctx.strokeStyle = '#9ca3af'; ctx.beginPath(); ctx.moveTo(pad, pad/2); ctx.lineTo(pad, H-pad); ctx.lineTo(W-pad/2, H-pad); ctx.stroke();
    values.forEach((v,i)=>{
      const x = pad + i*w + w*0.15; const h = v/max*(H-pad*2); const y = (H-pad)-h;
      const g = ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,colorTop); g.addColorStop(1,colorBottom);
      ctx.fillStyle = g; ctx.fillRect(x, y, w*0.7, h);
    });
  }

  // Heatmap-like block grid for zone-wise
  function drawZoneHeat(canvas, zones){
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const cols = 7, rows = Math.ceil(zones.length / cols);
    const cellW = Math.floor(W / cols); const cellH = Math.floor(H / rows);
    zones.forEach((z, i) => {
      const c = i % cols; const r = Math.floor(i / cols);
      const t = z.value / 100; // assume 0..100
      const mix = (a,b)=>Math.round(a+(b-a)*t);
      const light=[254,226,226], dark=[153,27,27]; // red ramp
      const fill = `rgb(${mix(light[0],dark[0])},${mix(light[1],dark[1])},${mix(light[2],dark[2])})`;
      ctx.fillStyle = fill;
      ctx.fillRect(c*cellW+2,r*cellH+2,cellW-4,cellH-4);
    });
  }

  // Downloads
  function download(filename, content, type){
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  }

  function toCSV(rows, header){ return header + '\n' + rows.map(r => r.join(',')).join('\n'); }
  function toXLS(rows){
    // Simple Excel-compatible CSV; many tools open .csv as Excel. We'll just name it .xls
    return rows.map(r => r.join(',')).join('\n');
  }

  function canvasToPDFPlaceholder(){
    alert('PDF export placeholder. For real PDFs, integrate jsPDF or a backend.');
  }

  function update(){
    // Response time (minutes) for last 7 days
    const resp = Array.from({length:7},()=> rand(3,12));
    barChart($('respChart'), resp, '#10b981', '#14532d');

    // Zone heat values (0..100)
    const zones = ['Panaji','Mapusa','Margao','Vasco','Ponda','Calangute','Bicholim','Canacona','Quepem','Sattari','Sanguem','Tiswadi','Bardez','Salcete']
      .map(name => ({ name, value: rand(10,100) }));
    drawZoneHeat($('zoneHeat'), zones);

    // Escalations list
    const esc = [
      ['R-1023','Passenger C','Unresponsive check','15:22'],
      ['R-1031','Passenger F','Escalated to officer','18:05'],
      ['R-1040','Passenger K','Deviations flagged','20:14']
    ];
    const escList = $('escList');
    escList.innerHTML = '';
    esc.forEach(row => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${row[0]} — ${row[1]} — ${row[2]}</span><span class="time">${row[3]}</span>`;
      escList.appendChild(li);
    });

    // AI Forecasts
    const hotspotForecast = $('hotspotForecast'); hotspotForecast.innerHTML='';
    const patrolForecast = $('patrolForecast'); patrolForecast.innerHTML='';
    ['Panaji','Calangute','Mapusa','Margao'].forEach(area => {
      const li = document.createElement('li');
      li.textContent = `${area}: spike risk ${(rand(10,30))}%`; hotspotForecast.appendChild(li);
    });
    ['Panaji PS','Mapusa PS','Margao PS','Ponda PS'].forEach(ps => {
      const li = document.createElement('li');
      li.textContent = `${ps}: suggest +${rand(1,3)} patrol units`; patrolForecast.appendChild(li);
    });

    // Bind downloads
    $('respCSV')?.addEventListener('click', ()=>{
      const rows = resp.map((v,i)=> [i+1, v]);
      download('daily_response_time.csv', toCSV(rows, 'day,value'), 'text/csv');
    });
    $('respXLS')?.addEventListener('click', ()=>{
      const rows = resp.map((v,i)=> [i+1, v]);
      download('daily_response_time.xls', toXLS(rows), 'application/vnd.ms-excel');
    });
    $('respPDF')?.addEventListener('click', canvasToPDFPlaceholder);

    $('zoneCSV')?.addEventListener('click', ()=>{
      const rows = zones.map((z)=> [z.name, z.value]);
      download('zone_incident_heatmap.csv', toCSV(rows, 'zone,value'), 'text/csv');
    });
    $('zoneXLS')?.addEventListener('click', ()=>{
      const rows = zones.map((z)=> [z.name, z.value]);
      download('zone_incident_heatmap.xls', toXLS(rows), 'application/vnd.ms-excel');
    });
    $('zonePDF')?.addEventListener('click', canvasToPDFPlaceholder);

    $('escCSV')?.addEventListener('click', ()=>{
      download('ride_safety_escalations.csv', toCSV(esc, 'ride,passenger,status,time'), 'text/csv');
    });
    $('escXLS')?.addEventListener('click', ()=>{
      download('ride_safety_escalations.xls', toXLS(esc), 'application/vnd.ms-excel');
    });
    $('escPDF')?.addEventListener('click', canvasToPDFPlaceholder);
  }

  function init(){
    $('refreshReports')?.addEventListener('click', update);
    update();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
