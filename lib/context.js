const { performance, PerformanceObserver } = require('perf_hooks');
const { delay } = require('./utils');

/**
 * @export
 * @class Context
 */
module.exports = class Context {
    /**
     * @param {Object} task
     */
    constructor(task){
        this.task = task;
        this.duration = null;
        this.done = undefined;
        this.finished = false;
        this.execution = undefined;
        this.running = undefined;
        this.timeout = undefined;

        // Defines duration once it starts
        const obs = new PerformanceObserver((items) => {
            this.duration = items.getEntries()[0].duration;
            performance.clearMarks();
            obs.disconnect();
        });
        obs.observe({ entryTypes: ['measure'] });
    }
    
    prev(){

    }
    
    log(){
        
    }

    startTimeout(){
        this.timeout = setTimeout(() => {
            this.cancel();
            this.done({error: 'Job timed out'});
        }, this.task.timeout || 5000);
    }

    /**
     * @param {Function} job - The job function to be executed
     */
    start(job){
        console.log(new Date().toISOString(), 'Started Running', this.task.id, 'date', this.task.date);
        performance.mark('job_start');
        // Defines a timeout for the job
        this.startTimeout();
        // Wrapps the execution into a setTimeout to be able to abort later
        this.execution = setTimeout(() => {
            try {
                this.running = job(this, this.done);
                const isAsync = job.length > 1;
                const isPromise = this.running && typeof this.running.then == 'function';
                // Promised based job
                if(isPromise){
                    this.running
                        // Resolved job
                        .then(res => this.done(null, res))
                        // Rejected job
                        .catch(err => {
                            this.done(err);
                        });
                }
                // Regular job
                if(!isAsync && !isPromise){
                    done();
                }
            } catch (error) {
                // Bad job
                this.done(error);
            }
        }, 0);
    }

    /**
     * @public
     */
    cancel(){
        clearTimeout(this.execution);
    }

    /**
     * @public
     * @returns {Number} duration - Time elapsed from start to stop in ms
     */
    stop(){
        console.log(new Date().toISOString(), 'Stoping');
        this.running = undefined;
        clearTimeout(this.timeout);
        performance.mark('job_stop');
        performance.measure('execution_time', 'job_start', 'job_stop');
        return this.duration;
    }

    /**
     * @private
     * @param {String} attr - Attribute to look for like repeat or retry
     * @param {Number} current - Current state of property like repeat.limit=100
     * @returns {Boolean} - rerunable or not
     */
    rerunable(attr, current = 0){
        const {task} = this,
            node = task[attr] || {},
            interval = node.interval,
            limit = node.limit || Infinity,
            canRerun = current < limit;
        
        if(node && interval && canRerun){
            return delay(task.date, interval);
        }
        return false;
    }

    /**
     * Ensure task is retryable
     * @private
     */
    retryable(){
        return this.rerunable('retry', this.task.retries);
    }
    
    /**
     * Ensure task is repeatable
     * @private
     */
    repeatable(){
        return this.rerunable('repeat', this.task.repetitions);
    }

    /**
     * @private
     * @param {Object | null} err 
     * @param {Object | null} res 
     * @returns {String} - complete, done, retry, failed
     */
    nextStatus(err, res){
        const success = () => {
            return this.repeatable() ? 'done' : 'complete';
        }
        const fail = () => {
            return this.retryable() ? 'retry' : 'failed';
        }
        return err ? fail() : success();
    }

    /**
     * @private
     * @param {Object | null} err 
     * @param {Object | null} res 
     * @returns {String} - Date ISO string
     */
    nextDate(err, res){
        const {task} = this;
        let {date} = task;

        const retryDate = this.retryable(),
            repeatDate = this.repeatable();

        if(err && retryDate){
            date = retryDate;
        } else if(repeatDate) {
            date = repeatDate;
        }

        return date;
    }

    /**
     * @private
     * @param {Object} err 
     * @param {Object} res
     * @returns {Object} - {retries, repetitions, executions}
     */
    nextIncrementables(err, res){
        const {task} = this,
            {status} = task,
            fromDone = (status === 'done'),
            fromRetry = (status === 'retry');
        let executions = task.executions || 0,
            retries = task.retries || 0,
            repetitions = task.repetitions || 0;
        
        if(err){
            if(fromRetry){
                retries = retries + 1;
            }
        } else {
            //reset retries
            retries = 0;
            if(fromDone){
                repetitions = repetitions + 1;
            }
        }

        // Always increment the execution
        executions = executions + 1;
        return {retries, repetitions, executions};
    }

    /**
     * @public
     * @param {Object} err 
     * @param {Object} res 
     * @returns {Object} - The next version of the task with all props
     */
    next(err, res){
        // Current task
        const {task} = this;
        let {date, status} = task;
        
        date = this.nextDate(err, res);
        const iterables = this.nextIncrementables(err, res);
        this.task = {
            ...this.task,
            ...iterables
        }
        status = this.nextStatus(err, res);

        return {
            ...task,
            date,
            status,
            error: err || null,
            result: res || false,
            duration: this.duration,
            ...iterables//unnecessary
        };
    }
}