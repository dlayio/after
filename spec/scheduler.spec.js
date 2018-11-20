const Scheduler = require('../lib/scheduler');
const {expect} = require('chai');

const change = {
    seq:'31-g1AAAACbeJzLYWBgYMpgTmEQTM4vTc5ISXLIyU9OzMnILy7JAUklMiTV____PyuDOZEjFyjAbmaelGZuboJNAx5j8liAJEMDkPoPNU0cbFqqpWmqsQVW07IAa8kwow',
    id: '857957d1f1631ac8714b5d1cfd000d39',
    changes: [ { rev: '2-d6c43bec951f93843bdd085f440a02fc' } ],
    doc: { 
        _id: '857957d1f1631ac8714b5d1cfd000d39',
        _rev: '2-d6c43bec951f93843bdd085f440a02fc',
        date: '2012-02-27',
        status: 'waiting',
        worker: 'manobi',
        data: { url: 'https://google.com' },
        job: 'clear'
    }
}
const task = change.doc;

const jobs = {
    encode: () => {},
    clear: () => {}
}

describe('Scheduler', () => {
    let scheduler;
    beforeEach(() => {
        scheduler = new Scheduler({
            precision: 1000
            // database: 'dlay_tasks',
            // host: 'localhost',
            // user: 'worker',
            // password: 'root',
            // seq: ''
        });
    });
    
    //scheduler.emit('change', task);

    describe('#schedule', () => {
        it('append the task to memory book', () => {
            const date = new Date().getTime(),
                job = jobs[task.job];
            
            scheduler.schedule({id: task._id, date, job});
            const totalScheduledTasks = scheduler.tasks.listenerCount(date);
            expect(totalScheduledTasks).to.be.equal(1);
            expect(scheduler.scheduled[task._id].run).to.be.a('function');
        });
    });
    describe('#unschedule', () => {
        it('removes a task from memory', () => {
            const date = new Date().getTime(),
                job = jobs[task.job];
            
            scheduler.schedule({id: task._id, date, job});
            scheduler.unschedule(task._id);
            const totalScheduledTasks = scheduler.tasks.listenerCount(date);
            expect(totalScheduledTasks).to.be.equal(0);
        });
    });
});