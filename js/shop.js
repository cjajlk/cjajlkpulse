// shop.js - simple boutique UI for selecting player skins
(function(){
  const skins = [
    { id: 'default', name: 'Nocturne (défaut)', color: '#9b6cff', cost: 0 },
    { id: 'red', name: 'Rouge néon', color: '#ff6b6b', cost: 50 },
    { id: 'blue', name: 'Bleu cyan', color: '#4cc9f0', cost: 30 },
    { id: 'yellow', name: 'Soleil', color: '#ffd166', cost: 20 }
  ];

  let selected = null;

  function applyPreview(id){
    selected = id;
    window.playerSkin = id;
    // highlight selected card
    document.querySelectorAll('.skinCard').forEach(el=> el.classList.toggle('skinSelected', el.dataset.id === id));
  }

  function purchaseSkin(s){
    try {
      // load profile
      let profile = null;
      if (typeof initProfile === 'function') profile = initProfile();
      if (!profile && typeof loadProfile === 'function') profile = loadProfile();
      if (!profile) profile = (typeof createDefaultProfile === 'function') ? createDefaultProfile() : { player:{}, progression:{}, inventory:{diamonds:0,skins:[]} };
      profile.inventory = profile.inventory || { diamonds:0, skins:[] };

      const owned = Array.isArray(profile.inventory.skins) && profile.inventory.skins.indexOf(s.id) !== -1;
      if (owned) {
        applyPreview(s.id);
        return true;
      }

      if (s.cost <= 0) {
        // free skin, grant ownership
        profile.inventory.skins = profile.inventory.skins || [];
        if (profile.inventory.skins.indexOf(s.id) === -1) profile.inventory.skins.push(s.id);
        if (typeof saveProfile === 'function') saveProfile(profile);
        try{ if (typeof updateDiamondsUI === 'function') updateDiamondsUI(); }catch(e){}
        applyPreview(s.id);
        renderShop();
        return true;
      }

      // attempt to spend diamonds
      if (typeof spendDiamonds === 'function'){
        const ok = spendDiamonds(s.cost);
        if (!ok) { alert("Vous n'avez pas assez de diamants"); return false; }
      } else {
        alert('Paiement indisponible');
        return false;
      }

      // grant ownership
      profile.inventory.skins = profile.inventory.skins || [];
      if (profile.inventory.skins.indexOf(s.id) === -1) profile.inventory.skins.push(s.id);
      if (typeof saveProfile === 'function') saveProfile(profile);
      try{ if (typeof updateDiamondsUI === 'function') updateDiamondsUI(); }catch(e){}

      // show purchase modal offering to equip or keep
      try{ showPurchaseModal(s.id, s.name); }catch(e){}
      renderShop();
      return true;
    } catch(e) { console.error('purchaseSkin failed', e); alert('Erreur achat'); return false; }
  }

  function saveSelection(){
    try{
      // ensure selected skin is owned (or purchase it)
      const s = skins.find(x=> x.id === selected);
      let prof = null;
      try{ prof = (typeof initProfile === 'function') ? initProfile() : (typeof loadProfile === 'function' ? loadProfile() : null); }catch(e){ prof = null; }
      const owned = prof && prof.inventory && Array.isArray(prof.inventory.skins) && prof.inventory.skins.indexOf(selected) !== -1;
      if (!owned && s && s.cost > 0){
        // ask to purchase
        if (!confirm(`Acheter ${s.name} pour ${s.cost} ♦ ?`)) return;
        const ok = purchaseSkin(s);
        if (!ok) return; // purchase failed or cancelled
      }
      // persist selected as player's skin
      try{
        let profile = prof || ((typeof loadProfile === 'function') ? loadProfile() : null);
        if (!profile) profile = (typeof createDefaultProfile === 'function') ? createDefaultProfile() : { player:{}, progression:{}, inventory:{diamonds:0,skins:[]} };
        profile.player = profile.player || {};
        profile.player.skin = selected || profile.player.skin || 'default';
        if (typeof saveProfile === 'function') saveProfile(profile);
        if (typeof updateState === 'function'){
          try{ updateState(state=>{ state.player = state.player || {}; state.player.skin = profile.player.skin; }); if (typeof saveProfile === 'function') saveProfile(); }catch(e){}
        }
      }catch(e){ console.error('saveSelection persist failed', e); }
      alert('Apparence enregistrée : ' + (s ? s.name : selected));
      closeShop();
      try{ if (typeof loadMenuProfile === 'function') loadMenuProfile(); }catch(e){}
    }catch(e){ console.error('saveSelection failed', e); alert('Erreur lors de la sauvegarde'); }
  }

  function openShop(){
    const modal = document.getElementById('shopModal');
    if (!modal) return;
    renderShop();
    modal.style.display = 'flex';
  }

  function closeShop(){
    const modal = document.getElementById('shopModal');
    if (!modal) return;
    modal.style.display = 'none';
    // restore preview to persisted skin
    try{
      let prof = (typeof initProfile === 'function') ? initProfile() : (typeof loadProfile === 'function' ? loadProfile() : null);
      const skin = (prof && prof.player && prof.player.skin) ? prof.player.skin : 'default';
      window.playerSkin = skin;
      document.querySelectorAll('.skinCard').forEach(el=> el.classList.toggle('skinSelected', el.dataset.id === skin));
    }catch(e){}
  }

  function renderShop(){
    const grid = document.getElementById('shopGrid');
    if(!grid) return;
    grid.innerHTML = '';
    // current skin from profile
    let prof = null;
    try{ prof = (typeof initProfile === 'function') ? initProfile() : (typeof loadProfile === 'function' ? loadProfile() : null); }catch(e){}
    const active = (prof && prof.player && prof.player.skin) ? prof.player.skin : 'default';
    selected = active;
    window.playerSkin = active;

    skins.forEach(s => {
      const card = document.createElement('div');
      card.className = 'skinCard';
      card.dataset.id = s.id;
      const preview = document.createElement('div');
      preview.className = 'skinPreview';
      preview.style.background = s.color;
      preview.style.border = '2px solid rgba(255,255,255,0.06)';
      const name = document.createElement('div'); name.className='skinName'; name.textContent = s.name;
      const cost = document.createElement('div'); cost.className='skinCost'; cost.textContent = s.cost > 0 ? s.cost + ' ♦' : 'Gratuit';
      card.appendChild(preview);
      card.appendChild(name);
      card.appendChild(cost);

      // check ownership
      const owned = (prof && prof.inventory && Array.isArray(prof.inventory.skins) && prof.inventory.skins.indexOf(s.id) !== -1) || s.id === 'default';

      // selection on click
      card.addEventListener('click', ()=> applyPreview(s.id));

      // action area: buy/apply/owned
      const action = document.createElement('div'); action.style.marginTop = '8px';
      if (owned) {
        const ownedEl = document.createElement('div'); ownedEl.textContent = 'Possédé'; ownedEl.style.color = '#b3ffd6'; ownedEl.style.fontSize = '13px'; action.appendChild(ownedEl);
      } else if (s.cost > 0) {
        const buyBtn = document.createElement('button'); buyBtn.textContent = 'Acheter ('+s.cost+'♦)'; buyBtn.style.padding='6px 8px'; buyBtn.style.borderRadius='8px'; buyBtn.style.border='none'; buyBtn.style.cursor='pointer'; buyBtn.className='primary';
        buyBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); purchaseSkin(s); });
        action.appendChild(buyBtn);
      } else {
        const freeEl = document.createElement('div'); freeEl.textContent = 'Gratuit'; freeEl.style.color = '#c9b0ff'; action.appendChild(freeEl);
      }
      card.appendChild(action);

      if (s.id === active) card.classList.add('skinSelected');
      grid.appendChild(card);
    });
  }

  // show purchase modal that offers to equip or keep the unlocked skin
  function showPurchaseModal(skinId, skinName){
    const modal = document.getElementById('purchaseModal');
    if(!modal) return;
    const title = document.getElementById('purchaseTitle');
    const text = document.getElementById('purchaseText');
    title.textContent = 'Achat débloqué';
    text.textContent = `Vous avez débloqué ${skinName}. Voulez-vous l'équiper maintenant ?`;
    modal.style.display = 'flex';

    const keepBtn = document.getElementById('purchaseKeepBtn');
    const equipBtn = document.getElementById('purchaseEquipBtn');

    function cleanup(){
      modal.style.display = 'none';
      keepBtn.removeEventListener('click', onKeep);
      equipBtn.removeEventListener('click', onEquip);
      modal.removeEventListener('click', onOverlay);
    }
    function onKeep(){ cleanup(); }
    function onEquip(){
      try{
        // persist equip
        let profile = null;
        try{ profile = (typeof initProfile === 'function') ? initProfile() : (typeof loadProfile === 'function' ? loadProfile() : null); }catch(e){ profile = null; }
        if(!profile) profile = (typeof createDefaultProfile === 'function') ? createDefaultProfile() : { player:{}, progression:{}, inventory:{diamonds:0,skins:[]} };
        profile.player = profile.player || {};
        profile.player.skin = skinId;
        if (typeof saveProfile === 'function') saveProfile(profile);
        try{ if (typeof updateState === 'function') updateState(state=>{ state.player = state.player || {}; state.player.skin = skinId; }); }catch(e){}
        applyPreview(skinId);
        try{ if (typeof loadMenuProfile === 'function') loadMenuProfile(); }catch(e){}
      }catch(e){ console.error('equip failed', e); }
      cleanup();
    }
    function onOverlay(e){ if(e.target === modal){ cleanup(); } }

    keepBtn.addEventListener('click', onKeep);
    equipBtn.addEventListener('click', onEquip);
    modal.addEventListener('click', onOverlay);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const shopBtn = document.getElementById('shopBtn');
    const shopCloseBtn = document.getElementById('shopCloseBtn');
    const shopSaveBtn = document.getElementById('shopSaveBtn');
    if (shopBtn) shopBtn.addEventListener('click', openShop);
    if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);
    if (shopSaveBtn) shopSaveBtn.addEventListener('click', saveSelection);

    // click outside to close
    const shopModal = document.getElementById('shopModal');
    if (shopModal) shopModal.addEventListener('click', (e)=>{ if (e.target === shopModal) closeShop(); });

    // apply persisted skin at start
    try{
      let prof = (typeof initProfile === 'function') ? initProfile() : (typeof loadProfile === 'function' ? loadProfile() : null);
      const skin = (prof && prof.player && prof.player.skin) ? prof.player.skin : 'default';
      window.playerSkin = skin;
    }catch(e){ window.playerSkin = 'default'; }
  });
})();
