export class AdaptiveQuestionLogic {  


    constructor(){
        this.schedule = [{
            clusterIndex: 0,
            stimIndex: 0,
        }];
        this.when = Session.get('currentTdfUnit').adaptive;
        this.curUnit = Session.get('currentTdfUnit');
        this.tdfId = Session.get('currentTdfId');
        this.userId = Meteor.userId();
        this.componentStates = ComponentStates.findOne({userId: this.userId, TDFId: this.tdfId})
        console.log('adaptive - componentStates:', this.componentStates, this.userId, this.tdfId);
    }
    

    //translate the logic to javascript code    
    async evaluate(logicString){
        //logic string is a string that contains the logic to be evaluated using IF THEN logic, 
        //currentUnit is the current unit that the logic is being evaluated for

        // you may use logic operators AND, OR, NOT, and the following variables:
        // C<cluster index>S<stimulus index> - this is a stimulus that the student has seen before
        // true - this is a boolean value
        // false - this is a boolean value
        // numbers - these are numbers
        // math operators + - * / % ( ) = - these are math operators

        //This returns an object with the following properties:
        // condition: the original condition string
        // conditionExpression: the translated condition string
        // actions: the original action string
        // conditionResult: the result of the condition evaluation
        // schedule: an array of objects with the unit and question to schedule

        //we have to get the student performance history



        console.log('evaluate logicString:', logicString);
        const operators = {
            "NOT": "!",
            "AND": "&&",
            "OR": "||"
        };

        //remove the IF prefix and split on keyword THEN. Before then is the condition, after then is the action
        //if parts
        let parts = logicString.replace("IF", "").split("THEN");
        let condition = parts[0].trim();
        let actions = parts[1].trim();

        //if condition or action is empty, return
        if(!condition || !actions){
            return {condition: condition, action: actions, conditionResult: false};
        }

        //tokenize the condition
        let conditionTokens = condition.split(" ");


        //translate the condition
        let conditionExpression = "";
        // Allowed math operators
        const mathOperators = "+-*/%()=";

        for(const token of conditionTokens){
            if(operators[token]){
                conditionExpression += operators[token];
            } else if (token.toLowerCase() === "true"){
                conditionExpression += "true";
            } else if (token.toLowerCase() === "false"){
                conditionExpression += "false";
            } else if (token.startsWith("C")){
                //the format for this is C<cluster index>S<stimulus index>
                let parts = token.split("C")[1].split("S");
                let clusterIndex = parseInt(parts[0]);
                let stimulusIndex = parseInt(parts[1]);
                //get the performance for this cluster and stimulus
                this.componentStates = ComponentStates.findOne({userId: this.userId, TDFId: this.tdfId})
                if(this.componentStates?.stimStates[stimulusIndex]){
                    console.log('getting component state for cluster:', clusterIndex, 'stimulus:', stimulusIndex, this.componentStates.stimStates[stimulusIndex]);
                    let outcome = this.componentStates.stimStates[stimulusIndex]?.outcomeStack[0] === 1;
                    //if the outcome is 1, lastOutcome is true, otherwise false
                    console.log('lastOutcome for ' + token + ':', outcome);
                    conditionExpression += outcome;
                } else {
                    console.log('no component state found for stimulus:', stimulusIndex);
                    conditionExpression += false;
                }
            } else if (Number.isInteger(parseInt(token))){
                conditionExpression += token;
            } else {
                //loop through each character in the token, if it is a math operator, add it to the expression. Otherwise, throw an error
                for(const char of token){
                    if(mathOperators.includes(char)){
                        conditionExpression += char;conditionExpression += lastOutcome === 1;
                        //check if a number
                        if(Number.isInteger(parseInt(char))){
                            conditionExpression += char;
                        } else {
                            throw new Error(`Invalid token: ${token}`);
                        }
                    }
                }
            }
        }

        console.log('conditionExpression:', conditionExpression);


        //build a new function that will be called to evaluate the condition
        let conditionFunction = new Function(`return ${conditionExpression}`);

        //evaluate the condition
        let conditionResult = conditionFunction();

        //destroy the function
        conditionFunction = null;

        //if the condition is false, end the function. Otherwise, evaluate the action
        if(!conditionResult){
            return;
        }

        //the action can be either a single action as a string or an array of actions. To check, we will find if parenthesis are present
        console.log('action:', actions);

        let addToschedule = [];

        let outcomes = [];
        
        ///check if there are parenthesis, if so interpret as an array of actions
        if(actions.includes("(")){
            let startIndex = actions.indexOf("(");
            let endIndex = actions.indexOf(")");
            let actionsString = actions.substring(startIndex + 1, endIndex);
            //add each action to the schedule
            for(const action of actionsString.split(",")){
                //the format is C<cluster index>S<stimulus index>, we add these to the schedule 
                if(action.startsWith("C")){
                    let parts = action.split("C")[1].split("S");
                    let KCI = parseInt(parts[0]);
                    let stimulusIndex = parseInt(parts[1]);
                    //if the outcome is string "correct", it is true, otherwise false
                    addToschedule.push({
                        clusterIndex: KCI,
                        stimIndex: stimulusIndex,
                    });
                    console.log('adding to adaptive schedule:', addToschedule);
                } else {
                    //throw an error if the action is not a valid action
                    throw new Error(`Invalid action: ${action}`);
                }
            }
        } else {
            //the action is a single action
            if(actions.startsWith("C")){
                let parts = actions.split("C")[1].split("S");
                let clusterIndex = parseInt(parts[0]);
                let stimulusIndex = parseInt(parts[1]);
                //if the outcome is string "correct", it is true, otherwise false
                addToschedule.push({
                    clusterIndex: clusterIndex,
                    stimulus: stimulusIndex,
                });
                console.log('adding to adaptive schedule:', addToschedule);
            } else {
                //throw an error if the action is not a valid action
                throw new Error(`Invalid action: ${actions}`);
            }
            //append to the schedule
            this.schedule.push(...addToschedule);
        }
        return {condition: condition, conditionExpression: conditionExpression, actions: actions, conditionResult: conditionResult, schedule: addToschedule};
    }
    unitBuilder(templateUnitNumber){
        //build the unit based on the base unit and the schedule
        let newUnit = Session.get('currentTdfFile').tdfs.tutor.unitTemplate[templateUnitNumber];
        //if newunit is not defined, throw an error
        if(!newUnit){
            alert(`There was an error building the unit. Please contact the administrator`);
            throw new Error(`Unit template ${templateUnitNumber} not found`);
        }
        if(newUnit.assessmentsession){
            newUnit.assessmentsession.clusterlist = ""
            for(const item of this.schedule){
                let cluster = item.clusterIndex;
                newUnit.assessmentsession.clusterlist += cluster + " ";
            }
            newUnit.assessmentsession.clusterlist = newUnit.assessmentsession.clusterlist.trim();
        } else if (newUnit.videosession) {
            if(!newUnit.videosession.questions){
                newUnit.videosession.questions = [];
            }
            for(const item of this.schedule){
                newUnit.videosession.questions.push(item.clusterIndex)
            }
            const questionTimes = newUnit.videosession.questiontimes;
            newUnit.videosession.questiontimes = [];
            for(const item of newUnit.videosession.questions){
                newUnit.videosession.questiontimes.push(questionTimes[item])
            }
        }
        //injected the new unit into the session
        return newUnit;
    }
}


