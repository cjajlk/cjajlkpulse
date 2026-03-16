class Obstacle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 40;
    this.speed = 6;
  }

  update() {
    let speed = typeof gameSpeed !== "undefined" ? gameSpeed : this.speed;
    if (typeof slowTimer !== "undefined" && slowTimer > 0) {
      speed *= 0.5;
    }
    if (typeof gameMode !== "undefined" && gameMode === "horizontal") {
      this.x -= speed;
    }
    if (typeof gameMode !== "undefined" && gameMode === "vertical") {
      this.y += speed;
    }
  }

 draw(ctx){

ctx.save()

    // neon pulsing effect (uses global obstaclePulse)
    const op = (typeof obstaclePulse !== 'undefined') ? obstaclePulse : 0;
    const pulse = Math.sin(op) * 0.5 + 0.5;
    const glow = 10 + pulse * 20;

    ctx.shadowColor = "#b84cff";
    ctx.shadowBlur = glow;

    ctx.fillStyle = "#8a2cff";
    ctx.fillRect(
      this.x - this.width/2,
      this.y - this.height/2,
      this.width,
      this.height
    );

    ctx.shadowBlur = 0;
    ctx.restore();

}
}