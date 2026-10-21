// Shared cooperative CPU budget: one small raster batch at a time. Interactive
// UI material jobs precede background image generators without blocking input.
const jobs=[];let scheduled=false;
function tick(){scheduled=false;const deadline=performance.now()+5;jobs.sort((a,b)=>a.priority-b.priority);while(jobs.length&&performance.now()<deadline){const job=jobs.shift();if(job.canceled)continue;try{if(!job.step())jobs.push(job);}catch(error){job.onError?.(error);}}if(jobs.length){scheduled=true;requestAnimationFrame(tick);}}
export function scheduleRaster(step,{priority=1,onError}={}){const job={step,priority,onError,canceled:false};jobs.push(job);if(!scheduled){scheduled=true;requestAnimationFrame(tick);}return()=>{job.canceled=true;};}
