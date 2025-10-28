const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx0L61joIbF6rMUe1nOmwUJ8fn3RlUsI2NB5f1uus-1j-Cs7wYIwKkfJmj1S2HuKSS5UQ/exec';

async function fetchData() {
    const loader = document.getElementById('loader');
    const errorContainer = document.getElementById('error-message');
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
        const data = await response.json();
        if (data.error) throw new Error(`Script Error: ${data.details || data.error}`);
        
        // Hide error message on success
        errorContainer.classList.add('hidden');
        return data;

    } catch (error) {
        console.error('Dashboard Error:', error);
        errorContainer.innerHTML = `
            <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
              <p class="font-bold">Failed to Load Dashboard Data</p>
              <p class="mt-1">${error.message}</p>
              <p class="font-bold mt-3">Troubleshooting Steps:</p>
              <ul class="list-disc list-inside mt-1 text-sm">
                <li>Ensure the 'SCRIPT_URL' variable in script.js is correct.</li>
                <li>In Google Apps Script, re-deploy your script and make sure "Who has access" is set to "Anyone".</li>
                <li>Check that the sheet name in your script ('Data') matches the tab in your Google Sheet.</li>
              </ul>
            </div>`;
        errorContainer.classList.remove('hidden');
        loader.style.display = 'none';
        document.getElementById('dashboard-content').classList.add('opacity-100');
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const data = await fetchData();
    document.getElementById('loader').style.display = 'none';

    if (data) {
        updateSummaryCards(data);
        createCollegeRadarChart(data);
        createSemesterBarChart(data);
        createHeatmap(data);
        populateActionItems(data);
        document.getElementById('dashboard-content').classList.add('opacity-100');
    }
    // Initialize Feather Icons and AOS after data attempt
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    if (typeof AOS !== 'undefined') {
        AOS.init();
    }
});

function updateSummaryCards(data) {
    const contentScores = data.map(row => parseFloat(row['Content Score'])).filter(s => !isNaN(s));
    const trainerScores = data.map(row => parseFloat(row['Trainer Score'])).filter(s => !isNaN(s));
    if (contentScores.length === 0) return;
    const avgContent = (contentScores.reduce((a, b) => a + b, 0) / contentScores.length).toFixed(2);
    const avgTrainer = (trainerScores.reduce((a, b) => a + b, 0) / trainerScores.length).toFixed(2);
    const allScores = [...contentScores, ...trainerScores];
    document.getElementById('avg-content-score').textContent = avgContent;
    document.getElementById('avg-trainer-score').textContent = avgTrainer;
    document.getElementById('highest-score').textContent = Math.max(...allScores).toFixed(2);
    document.getElementById('lowest-score').textContent = Math.min(...allScores).toFixed(2);
}

function createCollegeRadarChart(data) {
    const colleges = [...new Set(data.map(row => row['College']))];
    const datasets = colleges.map(college => {
        const collegeData = data.filter(row => row['College'] === college);
        const avgContent = (collegeData.map(r=>parseFloat(r['Content Score'])).reduce((a,b)=>a+b,0)/collegeData.length);
        const avgTrainer = (collegeData.map(r=>parseFloat(r['Trainer Score'])).reduce((a,b)=>a+b,0)/collegeData.length);
        const randomColor = `rgba(${Math.floor(Math.random()*150)}, ${Math.floor(Math.random()*150)}, ${Math.floor(Math.random()*255)}`;
        return { label: college, data: [avgContent, avgTrainer], backgroundColor: `${randomColor}, 0.2)`, borderColor: `${randomColor}, 1)` };
    });
    new Chart(document.getElementById('collegeRadarChart'),{type:'radar',data:{labels:['Content Score','Trainer Score'],datasets:datasets},options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:10}}}});
}

function createSemesterBarChart(data) {
    const semesters = [...new Set(data.map(row => row['Semester']))].sort();
    const semesterData = semesters.map(sem => {
        const semRows = data.filter(row => row['Semester'] === sem);
        return (semRows.map(r=>(parseFloat(r['Content Score'])+parseFloat(r['Trainer Score']))/2).reduce((a,b)=>a+b,0)/semRows.length).toFixed(2);
    });
    new Chart(document.getElementById('semesterBarChart'),{type:'bar',data:{labels:semesters,datasets:[{label:'Average Score',data:semesterData,backgroundColor:'rgba(79, 70, 229, 0.7)'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:10}}}});
}

function createHeatmap(data) {
    const subjects = [...new Set(data.map(row => row['Subject']))];
    const colleges = [...new Set(data.map(row => row['College']))];
    const series = colleges.map(college => ({
        name: college,
        data: subjects.map(subject => {
            const filtered = data.filter(d=>d.College===college&&d.Subject===subject);
            if(filtered.length === 0) return {x:subject, y:null};
            const avgScore = (filtered.map(r=>(parseFloat(r['Content Score'])+parseFloat(r['Trainer Score']))/2).reduce((a,b)=>a+b,0)/filtered.length);
            return {x:subject, y:avgScore.toFixed(2)};
        })
    }));
    new ApexCharts(document.querySelector("#heatmap"), {
        series:series,chart:{type:'heatmap',height:350,toolbar:{show:false}},
        plotOptions:{heatmap:{colorScale:{ranges:[{from:0,to:6,color:'#EF4444',name:'Low'},{from:6,to:8,color:'#F59E0B',name:'Mid'},{from:8,to:10,color:'#10B981',name:'High'}]}}},
    }).render();
}

function populateActionItems(data) {
    const lowScores = data.filter(row => parseFloat(row['Content Score']) < 7 || parseFloat(row['Trainer Score']) < 7);
    const tableBody = document.getElementById('action-items-body');
    tableBody.innerHTML = '';
    if (lowScores.length === 0) {
         tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-gray-500">No priority action items found. Great work!</td></tr>';
         return;
    }
    lowScores.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${row['Subject']}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${row['College']}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">Review Feedback</td>`;
        tableBody.appendChild(tr);
    });
}


