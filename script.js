const topics = ["music", "history", "tech", "geography", "cinema", "sport", "animals"];

let classifier;
let microphone;
let questionIndex = 0;
let numberOfQuestions = 5;
let score = 0;
let questions = [];
let soundModel = 'https://alexi-reyes.github.io/voicequizz/model/model.json';
let quizStarted = false;
let receivedApiResponse = false;
let topic = "music";

function preload() {
    classifier = ml5.soundClassifier(soundModel, function() {
        console.log("Model loaded!");
    }, function(error) {
        if (error) {
            console.error("Model load error:", error);
        }
    });
}

function setup() {
    createCanvas(0, 0);
    microphone = new p5.AudioIn();
    microphone.start(function() {
        console.log("Microphone started!");
        startClassification();
    });
}

function startClassification() {
    classifier.classify(microphone, gotResult);
}

function gotResult(error, results) {
    if (error) {
        console.error(error);
        return;
    }

    const wordSpoken = results[0].label;
    console.log("Recognized:", wordSpoken);

    if (wordSpoken === 'Start' && !quizStarted) {
        startQuiz();
        quizStarted = true;
    } else if (['1', '2', '3', '4'].includes(wordSpoken) && quizStarted && receivedApiResponse) {
        checkAnswer(wordSpoken);
    }
}

async function startQuiz() {
    questionIndex = 0;
    score = 0;
    questions = [];
    select('#feedback').html('');
    select('#answers').html('');

    topic = topics[Math.floor(Math.random() * topics.length)];


    const prompt = `Create ${numberOfQuestions} trivia questions about ${topic}. 
    Each question should have one correct answer and three incorrect options. 
    There should only have one correct answer.
    DO NOT ADD MARKDOWN. 
    Format: { question: "question Number:..."| answers: "1: ..., 2: ..., 3: ..., 4: ..."| correct_answer: "answer number" }`;

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "llama3.1",
                prompt: prompt,
                stream: false,
                options: { temperature: 0.7, max_tokens: 500 }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const apiResponseText = data.response;
        console.log("API Response Text:", apiResponseText);

        extractQuestionData(apiResponseText);
        receivedApiResponse = true;
        console.log(questions);
    } catch (error) {
        console.error('Fetch Error:', error);
        select('#feedback').html('Failed to generate questions.');
    }
    askQuestions();
}

function askQuestions() {
    if (questionIndex < numberOfQuestions) {
        if (questions.length > 0) {
            select('#question').html(questions[questionIndex]["question"]);

            const answersDiv = select('#answers');
            answersDiv.html('');

            for (const key in questions[questionIndex]["answers"]) {
                let answerElementButton = document.createElement('button');
                let answerElementText = document.createTextNode(questions[questionIndex]["answers"][key]);
                answerElementButton.appendChild(answerElementText);
                answerElementButton.classList.add('answer');
                answerElementButton.setAttribute('id', 'answer-' + key);
                answerElementButton.addEventListener('click', () => checkAnswer(key));
                answersDiv.elt.appendChild(answerElementButton);
            }
        } else {
            select('#feedback').html('No questions received from API.');
        }
    } else {
        console.log("Quizz ended!")
        select('#question').html('Quiz finished!');
    }
}

function checkAnswer(wordSpoken) {
    console.log("Checking answer");

    let correctAnswer = questions[questionIndex]["correct_answer"];

    if (wordSpoken == correctAnswer) {
        console.log("Added score");
        score++;
        questionIndex++;
        select('#feedback').html('Correct!');
        document.getElementById('feedback').classList.remove("incorrect");
        document.getElementById('feedback').classList.add("correct");
        select('#score').html('Score: ' + score);
    } else {
        document.getElementById('feedback').classList.remove("correct");
        select('#feedback').html('Wrong Answer!');
        document.getElementById('feedback').classList.add("incorrect");
    }

    if(questionIndex < numberOfQuestions){
        askQuestions();
    } else {
        quizStarted = false;
        select('#question').html('Quiz finished!');
    }
}



function extractQuestionData(inputString) {
    let counter = 1;
    let individualQuestion = {};

    for (splitQuestion of splitStringByString(inputString, '{')) {
        if (splitQuestion !== "") {
            for (part of splitStringByString(splitQuestion, '|')) {
                counter++;
    
                if (part.includes("question:")) {
                    individualQuestion.question = extractTextInQuotes(part);
                }
                if (part.includes("answers:")) {
                    choices = [];
                    for (choice of splitStringByString(part, ",")) {
                        text = choice.replace('"', '');
                        text = text.replace("answers: ", "")
                        choices.push(text);
                    }
    
                    individualQuestion.answers = choices;
                }
                if (part.includes("correct_answer:")) {
                    individualQuestion.correct_answer = extractTextInQuotes(part);
                }

                if (counter === 4) {
                    questions.push(individualQuestion)
                    individualQuestion = {};
                    counter = 1;
                }
            }
        }
    }
}



function splitStringByString(str, splitBy) {
    if (typeof str !== 'string' && typeof splitBy !== 'string') {
        return [];
    }
    return str.split(splitBy);
}

function extractTextInQuotes(str) {
    if (typeof str !== 'string') {
        return null;
    }

    const regex = /"([^"]*)"/; // Matches anything between double quotes
    const match = str.match(regex);

    if (match && match[1]) {
        return match[1]
    } else {
        return null;
    }
}
