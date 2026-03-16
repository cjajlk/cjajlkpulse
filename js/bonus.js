class Bonus {

constructor(x,y,type){
this.x = x
this.y = y
this.radius = 10
this.type = type
this.speed = 4
}

update(){
this.x -= this.speed
}

draw(ctx){

	// Effet de flottement
	let float = Math.sin(Date.now() * 0.005) * 3;

	ctx.beginPath();

	if (this.type === "slow") {
		ctx.fillStyle = "#00e5ff";
	}

	if (this.type === "score") {
		ctx.fillStyle = "#ffd700";
	}

	ctx.arc(this.x, this.y + float, this.radius, 0, Math.PI * 2);

	ctx.shadowColor = ctx.fillStyle;
	ctx.shadowBlur = 20;

	ctx.fill();

	ctx.shadowBlur = 0;

}

}
