

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
  let clientX = e.clientX;
  let clientY = e.clientY;
  if (e.touches && e.touches[0]) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }

  const halfW = window.innerWidth / 2;
  const halfH = window.innerHeight / 2;

  if (gameMode === "horizontal") {
    if (clientY < halfH) moveLeft(); else moveRight();
  } else {
    if (clientX < halfW) moveLeft(); else moveRight();
  }

  // Prevent default so taps don't trigger scrolling
  if (e.preventDefault) e.preventDefault();
}

canvasEl.addEventListener("pointerdown", handlePointerStart);
canvasEl.addEventListener("touchstart", handlePointerStart, {passive:false});