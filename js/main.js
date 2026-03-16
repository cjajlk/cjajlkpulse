

function moveLeft(){
  let newLane = Math.max(0, player.targetLane - 1);
  if(newLane !== player.targetLane){
    player.targetLane = newLane;
    if(typeof soundMove === "function") soundMove();
    if(typeof laneSwitchTimer !== "undefined") laneSwitchTimer = typeof PERFECT_WINDOW !== "undefined" ? PERFECT_WINDOW : 12;
  }
}


function moveRight(){
  let newLane = Math.min(2, player.targetLane + 1);
  if(newLane !== player.targetLane){
    player.targetLane = newLane;
    if(typeof soundMove === "function") soundMove();
    if(typeof laneSwitchTimer !== "undefined") laneSwitchTimer = typeof PERFECT_WINDOW !== "undefined" ? PERFECT_WINDOW : 12;
  }
}

document.addEventListener("keydown", (e) => {

  if (gameOver && e.code === "Space") {
    resetGame();
    return;
  }

  if (gameMode === "horizontal") {

    if (e.code === "ArrowUp") moveLeft();
    if (e.code === "ArrowDown") moveRight();

  }

  if (gameMode === "vertical") {

    if (e.code === "ArrowLeft") moveLeft();
    if (e.code === "ArrowRight") moveRight();

  }

});

// Contrôles tactiles / pointer pour mobile et tablettes
const canvasEl = document.getElementById("gameCanvas");
function handlePointerStart(e) {
  // support touch events as well
  // If game is over, tap should restart the run
  try{ if (typeof gameOver !== 'undefined' && gameOver){ resetGame(); return; } }catch(err){}
  let clientX = e.clientX;
  let clientY = e.clientY;
  if (e.touches && e.touches[0]) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }

  // compute coordinates relative to the canvas element to handle offsets/scaling
  const rect = canvasEl.getBoundingClientRect();
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;

  // split the canvas into three zones to directly choose a lane (top/middle/bottom or left/center/right)
  if (gameMode === "horizontal") {
    const hThird = rect.height / 3;
    let laneIndex = 1;
    if (relY < hThird) laneIndex = 0;
    else if (relY >= hThird * 2) laneIndex = 2;
    // set directly to avoid multiple taps
    if (player && typeof player.targetLane !== 'undefined') {
      player.targetLane = laneIndex;
      if(typeof soundMove === "function") soundMove();
      if(typeof laneSwitchTimer !== "undefined") laneSwitchTimer = typeof PERFECT_WINDOW !== "undefined" ? PERFECT_WINDOW : 12;
    }
  } else {
    const wThird = rect.width / 3;
    let laneIndex = 1;
    if (relX < wThird) laneIndex = 0;
    else if (relX >= wThird * 2) laneIndex = 2;
    if (player && typeof player.targetLane !== 'undefined') {
      player.targetLane = laneIndex;
      if(typeof soundMove === "function") soundMove();
      if(typeof laneSwitchTimer !== "undefined") laneSwitchTimer = typeof PERFECT_WINDOW !== "undefined" ? PERFECT_WINDOW : 12;
    }
  }

  // Prevent default so taps don't trigger scrolling
  if (e.preventDefault) e.preventDefault();
}

canvasEl.addEventListener("pointerdown", handlePointerStart);
canvasEl.addEventListener("touchstart", handlePointerStart, {passive:false});