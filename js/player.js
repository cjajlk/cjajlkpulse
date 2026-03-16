class Player {

constructor(x,y){
this.x = x
this.y = y
this.radius = 12

this.targetLane = 1
this.lane = 1

this.speed = 0.2

this.trail = []
}

update(lanes, mode){

	let target;

	if(mode === "horizontal"){
		target = lanes[this.targetLane];
		this.y += (target - this.y) * 0.2;
	}

	if(mode === "vertical"){
		target = lanes[this.targetLane];
		this.x += (target - this.x) * 0.2;
	}

this.trail.push({x:this.x, y:this.y})

if(this.trail.length > 10){
this.trail.shift()
}

}

draw(ctx){

	// Affiche la traînée
  // Affiche la traînée néon (plus marquée)
  ctx.save();
  for(let i=0;i<this.trail.length;i++){
    const t = this.trail[i];
    const k = i / this.trail.length;
    ctx.beginPath();
    ctx.arc(t.x, t.y, this.radius * (0.6 * (1 - k) + 0.3), 0, Math.PI*2);
    ctx.fillStyle = `rgba(155,108,255,${0.18 * (1 - k)})`;
    ctx.shadowColor = '#9b6cff';
    ctx.shadowBlur = (typeof lowPerfMode !== 'undefined' && lowPerfMode) ? 2 * (1 - k) : 6 * (1 - k);
    ctx.fill();
  }
  ctx.restore();


  // Stretch pendant le mouvement (plus subtil et directionnel)
  ctx.save();
  let scaleX = 1, scaleY = 1;
  if (typeof this.targetLane !== "undefined" && lanes) {
    if (arguments[1] === "horizontal") {
      let target = lanes[this.targetLane];
      let speed = Math.abs(target - this.y);
      scaleX = 1 + Math.min(speed * 0.008, 0.18); // max 18% stretch
    } else if (arguments[1] === "vertical") {
      let target = lanes[this.targetLane];
      let speed = Math.abs(target - this.x);
      scaleY = 1 + Math.min(speed * 0.008, 0.18);
    }
  }
  ctx.translate(this.x, this.y);
  ctx.scale(scaleX, scaleY);
  ctx.beginPath();
  ctx.arc(0, 0, this.radius, 0, Math.PI*2);
  // skin-aware coloring: use window.playerSkin if provided
  const skinColors = { default: '#9b6cff', red: '#ff6b6b', blue: '#4cc9f0', yellow: '#ffd166' };
  const skin = (typeof window !== 'undefined' && window.playerSkin) ? window.playerSkin : 'default';
  const color = skinColors[skin] || skinColors['default'];
  ctx.shadowColor = color;
  ctx.shadowBlur = (typeof lowPerfMode !== 'undefined' && lowPerfMode) ? 6 : 20;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

moveUp(){
if(this.targetLane > 0){
this.targetLane--
}
}

moveDown(){
if(this.targetLane < 2){
this.targetLane++
}
}

}