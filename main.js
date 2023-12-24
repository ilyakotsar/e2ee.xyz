function generateKeys() {
    const min = 100;
    const max = 110;
    const privateKeyLength = Math.floor(Math.random() * (max - min) + min);
    let privateKey = '';
    for (let i = 0; i < privateKeyLength; i++) {
        const digit = Math.floor(Math.random() * 10);
        privateKey += digit.toString();
    }
    hiddenPrivateKey = '';
    for (let i = 0; i < 50; i++) {
        hiddenPrivateKey += '●';
    }
    const g = document.getElementById('g').value;
    const p = document.getElementById('p').value;
    const publicKey = bigInt(g).modPow(privateKey, p).toString();
    document.getElementById('private-key').value = privateKey;
    document.getElementById('hidden-private-key').value = hiddenPrivateKey;
    document.getElementById('private-key-display').value = hiddenPrivateKey;
    document.getElementById('public-key').value = publicKey;
    const name = document.getElementById('public-key-name').value;
    document.getElementById('public-key-display').innerHTML = `${name}: ${publicKey}`;
    document.getElementById('generate-keys-btn').className = 'd-none';
    document.getElementById('private-key-div').classList.remove('d-none');
    document.getElementById('create-room-form').classList.remove('d-none');
}

function createRoom() {
    const csrfToken = document.getElementsByName('csrfmiddlewaretoken')[0].value;
    let url;
    if (document.getElementById('link')) {
        const link = document.getElementById('link').value;
        url = `/create/${link}`
    }
    else {
        url = '/create'
    }
    axios({
        method: 'post',
        url: url,
        headers: {
            'X-CSRFToken': csrfToken
        },
        data: {
            create: true
        }
    }).then((res) => {
        if (res.data['g'] && res.data['p']) {
            const g = res.data['g'];
            const p = res.data['p'];
            document.getElementById('g').value = g;
            document.getElementById('p').value = p;
            document.getElementById('g-display').innerHTML = `g = ${g}`;
            document.getElementById('p-display').innerHTML = `p = ${p}`;            
            document.getElementById('spinner').className = 'd-none';
            document.getElementById('generate-keys-btn').classList.remove('d-none');
        }
    });
}

function runDemo() {
    document.getElementById('demo-btn').innerHTML = '';
    document.getElementById('create-room-demo').classList.remove('d-none');
    createRoom();
}

function copyInput(btn, inputID, translatedCopy, translatedCopied) {
    const text = document.getElementById(inputID).value;
    navigator.clipboard.writeText(text).then(() => {
        if (translatedCopy && translatedCopied) {
            btn.innerHTML = `${translatedCopied}!`;
            setTimeout(() => {
                btn.innerHTML = translatedCopy;
            }, '1500');
        }
        else {
            btn.innerHTML = '<i class="bi bi-check2"></i>';
            setTimeout(() => {
                btn.innerHTML = '<i class="bi bi-copy"></i>';
            }, '1500');
        }
    });
}

function copyMessage(id) {
    const text = document.getElementById(id).innerHTML;
    navigator.clipboard.writeText(text).then(() => {});
}

function switchPrivateKey(btn) {
    const privateKeyDisplay = document.getElementById('private-key-display');
    const privateKey = document.getElementById('private-key');
    const hiddenPrivateKey = document.getElementById('hidden-private-key');
    if (privateKeyDisplay.value.includes('●')) {
        privateKeyDisplay.value = privateKey.value;
        btn.innerHTML = '<i class="bi bi-eye"></i>';
    }
    else {
        privateKeyDisplay.value = hiddenPrivateKey.value;
        btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
    }
}

function switchUsername(btn) {
    const usernameDisplay = document.getElementById('username-display');
    const username = document.getElementById('username');
    if (usernameDisplay.innerHTML.includes('*')) {
        usernameDisplay.innerHTML = username.value;
        btn.innerHTML = '<i class="bi bi-eye"></i>';
    }
    else {
        usernameDisplay.innerHTML = '**********';
        btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
    }
}

function switchPassword(btn, input) {
    const password = document.getElementById(input);
    if (password.type === 'password') {
        password.type = 'text';
        btn.innerHTML = '<i class="bi bi-eye"></i>';
    }
    else {
        password.type = 'password';
        btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
    }
}

function switchTheme(btn) {
    const csrfToken = document.getElementsByName('csrfmiddlewaretoken')[0].value;
    axios({
        method: 'post',
        url: '/switch-theme',
        headers: {
            'X-CSRFToken': csrfToken
        }
    }).then((res) => {
        if (res.data['theme']) {
            document.body.className = `${res.data['theme']}-theme`;
            btn.blur();
        }
    });
}

function addSpinner(btn, form) {
    if (form) {
        const f = document.getElementById(form);
        f.onsubmit = () => {
            btn.disabled = true;
            const x = btn.innerHTML;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${x}`;
        }
    }
    else {
        btn.disabled = true;
        const x = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${x}`;
    }
}

function changeScreen() {
    const encrypted = document.getElementById('encrypted');
    const decrypted = document.getElementById('decrypted');
    if (encrypted.classList.contains('visible')) {
        encrypted.classList.remove('visible');
        decrypted.classList.add('visible');
    }
    else if (decrypted.classList.contains('visible')) {
        decrypted.classList.remove('visible');
        encrypted.classList.add('visible');
    }
}

function formatDatetime(datetime) {
    const time = datetime.toLocaleTimeString('ru');
    const date = datetime.toLocaleDateString('ru');
    return `${time.slice(0, 5)} - ${date.slice(0, 5)}`;
}

function switchCheckbox(checkbox, btnID) {
    try {
        if (checkbox.checked) {
            document.getElementById(btnID).disabled = false;
        }
        else {
            document.getElementById(btnID).disabled = true;
        }
    }
    catch (error) {}
}

function showAccessKey(btn) {
    btn.disabled = true;
    const x = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${x}`;
    const csrfToken = document.getElementsByName('csrfmiddlewaretoken')[0].value;
    axios({
        method: 'post',
        url: '/account',
        headers: {
            'X-CSRFToken': csrfToken
        },
        data: {
            showAccessKey: true
        }        
    }).then((res) => {
        if (res.data['accessKey']) {
            document.getElementById('access-key-display').innerHTML = res.data['accessKey'];
            btn.className = 'd-none';
        }
    });
}

if (window.location.pathname === '/') {
    const now = new Date();
    const formattedDatetime = formatDatetime(now);
    const dt = document.getElementsByName('datetime');
    for (let i = 0; i < dt.length; i++) {
      dt[i].innerHTML = formattedDatetime;
      dt[i].title = now.toString();
    }
    setTimeout(() => {
      changeScreen();
      setInterval(changeScreen, 4500);
    }, 1500);
}

if (window.location.pathname.slice(0, 7) === '/create') {
    createRoom();
}
