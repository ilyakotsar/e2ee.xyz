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

function encryptText(plaintext, iv) {
    const ciphertext = CryptoJS.AES.encrypt(plaintext, encryptionKey, {iv: iv}).toString();
    return ciphertext;
}

function decryptText(ciphertext, ivBase64) {
    const iv = CryptoJS.enc.Base64.parse(ivBase64);
    const plaintext = CryptoJS.AES.decrypt(ciphertext, encryptionKey, {iv: iv}).toString(CryptoJS.enc.Utf8);
    return plaintext;
}

function getRoomData() {
    axios({
        method: 'post',
        url: `/rooms/${roomNumber}`,
        headers: {
            'X-CSRFToken': csrfToken
        },
        data: {
            getRoomData: true
        }
    }).then((res) => {
        userID = res.data['userID'];
        encryptedName = res.data['encryptedName'];
        myIV = res.data['myIV'];
        recipientEncryptedName = res.data['recipientEncryptedName'];
        recipientIV = res.data['recipientIV'];
        recipientPublicKey = res.data['recipientPublicKey'];
        p = res.data['p'];
        salt = CryptoJS.enc.Base64.parse(res.data['salt']);
        iterations = parseInt(res.data['iterations']);
        messageIDList = res.data['messageIDList'];
        userIDList = res.data['userIDList'];
        encryptedTextList = res.data['encryptedTextList'];
        ivList = res.data['ivList'];
        datetimeList = res.data['datetimeList'];
        lastDatetime = res.data['lastDatetime'];
        if (encryptedName) {
            document.getElementById('encrypted-name').value = encryptedName;
        }
        else {
            document.getElementById('encrypted-name').value = 'Anonymous';
        }        
        if (recipientEncryptedName) {
            document.getElementById('recipient-encrypted-name').innerHTML = recipientEncryptedName;
        }
        else {
            document.getElementById('recipient-encrypted-name').innerHTML = 'Anonymous';
        }
        const messages = document.getElementById('messages');
        messages.innerHTML = '';
        if (encryptedTextList.length > 0) {
            for (let i = 0; i < encryptedTextList.length; i++) {
                displayMessage(messageIDList[i], userIDList[i], encryptedTextList[i], datetimeList[i], 'encrypted');
            }
        }
        messages.scrollTop = messages.scrollHeight;
        const privateKeyModal = new bootstrap.Modal(document.getElementById('private-key-modal')); 
        privateKeyModal.show();
        setTimeout(() => {
            document.getElementById('private-key').focus();
        }, '100');
    });
}

function enterPrivateKey() {
    const privateKey = document.getElementById('private-key').value.trim();
    if (privateKey.length > 0) {
        intervalEnabled = false;
        document.getElementById('enter-private-key').disabled = true;
        const x = document.getElementById('enter-private-key').innerHTML;
        document.getElementById('enter-private-key').innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${x}`;
        setTimeout(function() {
            try {
                const sharedSecretKey = bigInt(recipientPublicKey).modPow(privateKey, p).toString();
                encryptionKey = CryptoJS.PBKDF2(sharedSecretKey, salt, {
                    keySize: 256 / 32,
                    iterations: iterations
                });
                if (encryptedTextList.length > 0) {
                    document.getElementById('messages').innerHTML = '';
                    for (let i = 0; i < encryptedTextList.length; i++) {
                        let plaintext;
                        try {
                            plaintext = decryptText(encryptedTextList[i], ivList[i]);
                        }
                        catch (error) {}
                        if (plaintext) {
                            displayMessage(messageIDList[i], userIDList[i], plaintext, datetimeList[i]);
                        }
                        else {
                            displayMessage(messageIDList[i], userIDList[i], encryptedTextList[i], datetimeList[i], 'encrypted');
                        }
                    }
                }
                if (encryptedName) {
                    document.getElementById('encrypted-name').value = decryptText(encryptedName, myIV);
                }
                if (recipientEncryptedName) {
                    document.getElementById('recipient-encrypted-name').innerHTML = decryptText(recipientEncryptedName, recipientIV);
                }
                const privateKeyModal = bootstrap.Modal.getInstance(document.getElementById('private-key-modal'));
                privateKeyModal.hide();
                document.getElementById('send-message').classList.remove('d-none');
                document.getElementById('message').disabled = false;
            }
            catch (error) {}
            document.getElementById('enter-private-key').innerHTML = x;
            document.getElementById('enter-private-key').disabled = false;
            intervalEnabled = true;
        }, 5);
    }
    else {
        document.getElementById('private-key').value = '';
    }
}

function getNewMessages() {
    if (intervalEnabled) {
        axios({
            method: 'post',
            url: `/rooms/${roomNumber}`,
            headers: {
                'X-CSRFToken': csrfToken
            },
            data: {
                lastDatetime: lastDatetime
            }
        }).then((res) => {
            if (res.data['lastDatetime']) {
                for (let i = 0; i < res.data['encryptedTextList'].length; i++) {
                    messageIDList.push(res.data['messageIDList'][i]);
                    userIDList.push(res.data['userIDList'][i]);
                    encryptedTextList.push(res.data['encryptedTextList'][i]);
                    ivList.push(res.data['ivList'][i]);
                    datetimeList.push(res.data['datetimeList'][i]);
                    if (encryptionKey) {
                        const plaintext = decryptText(res.data['encryptedTextList'][i], res.data['ivList'][i]);
                        displayMessage(res.data['messageIDList'][i], res.data['userIDList'][i], plaintext, res.data['datetimeList'][i]);
                    }
                    else {
                        displayMessage(res.data['messageIDList'][i], res.data['userIDList'][i], res.data['encryptedTextList'][i], res.data['datetimeList'][i], 'encrypted');
                    }
                }
                lastDatetime = res.data['lastDatetime'];
                const messages = document.getElementById("messages");
                messages.scrollTop = messages.scrollHeight;
            }
        });
    }
}

function sendMessage() {
    if (encryptionKey) {
        const message = document.getElementById('message').value.trim();
        if (message != '' && message.length < 3000) {
            intervalEnabled = false;
            const iv = CryptoJS.lib.WordArray.random(128 / 8);
            const ciphertext = encryptText(message, iv);
            axios({
                method: 'post',
                url: `/rooms/${roomNumber}`,
                headers: {
                    'X-CSRFToken': csrfToken
                },
                data: {
                    ciphertext: ciphertext,
                    iv: iv.toString(CryptoJS.enc.Base64)
                }
            }).then((res) => {
                if (res.data['datetime']) {
                    document.getElementById('message').value = '';
                }
                else {
                    alert('Error: limit exceeded');
                }
                intervalEnabled = true;
            });
        }
        else {
            document.getElementById('message').value = '';
        }
    }
    else {
        const privateKeyModal = new bootstrap.Modal(document.getElementById('private-key-modal'));
        privateKeyModal.show();
    }
}

function displayMessage(message, user, text, datetime, mode) {
    const dt = new Date(datetime);
    const formattedDatetime = formatDatetime(dt);
    const fullDatetime = dt.toString();
    const lock = '<i class="bi bi-lock-fill"></i>';
    let x;
    if (mode === 'encrypted') {
        if (user === userID) {
            x = `
            <div class="d-flex justify-content-end">
                <div class="my-message word-break-all">
                    ${lock}
                    <span>${text}</span>
                    <div class="text-end datetime"><span title="${fullDatetime}">${formattedDatetime}</span></div>
                </div>
            </div>`;
        }
        else {
            x = `
            <div class="d-flex">
                <div class="other-message word-break-all">
                    ${lock}
                    <span>${text}</span>
                    <div class="text-end datetime"><span title="${fullDatetime}">${formattedDatetime}</span></div>
                </div>
            </div>`;
        }
    }
    else {
        if (user === userID) {
            x = `
            <div class="d-flex justify-content-end dropdown">
                <button class="my-message" type="button" data-bs-toggle="dropdown" data-bs-offset="0, 0">
                    <span id="${message}">${text}</span>
                    <div class="text-end datetime"><span title="${fullDatetime}">${formattedDatetime}</span></div>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><button onclick="copyMessage(${message})" class="dropdown-item" type="button">Copy</button></li>
                    <li><button class="dropdown-item">Delete</button></li>
                </ul>
            </div>`;
        }
        else {
            x = `
            <div class="d-flex dropdown">
                <button class="other-message" type="button" data-bs-toggle="dropdown" data-bs-offset="0, 0">
                    <span id="${message}">${text}</span>
                    <div class="text-end datetime"><span title="${fullDatetime}">${formattedDatetime}</span></div>
                </button>
                <ul class="dropdown-menu">
                    <li><button onclick="copyMessage(${message})" class="dropdown-item" type="button">Copy</button></li>
                    <li><button class="dropdown-item">Delete</button></li>
                </ul>
            </div>`;
        }
    }
    document.getElementById('messages').innerHTML += x;
}

function changeName() {
    if (encryptionKey) {
        const eName = document.getElementById('encrypted-name').value.trim();
        if (eName != '' && eName.length < 25) {
            const iv = CryptoJS.lib.WordArray.random(128 / 8);
            const ciphertext = encryptText(eName, iv);
            axios({
                method: 'post',
                url: `/rooms/${roomNumber}`,
                headers: {
                    'X-CSRFToken': csrfToken
                },
                data: {
                    setName: ciphertext,
                    iv: iv.toString(CryptoJS.enc.Base64)
                }
            }).then((res) => {
                if (res.data['success']) {
                    document.getElementById('encrypted-name').value = eName;
                }
            });
        }
    }
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

function runDemo() {
    document.getElementById('demo-btn').innerHTML = '';
    document.getElementById('create-room-demo').classList.remove('d-none');
    createRoom();
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

const csrfToken = document.getElementsByName('csrfmiddlewaretoken')[0].value;

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

if (document.getElementById('room-number')) {
    var roomNumber = document.getElementById('room-number').value;
    var userID;
    var encryptedName;
    var myIV;
    var recipientEncryptedName;
    var recipientIV;
    var recipientPublicKey;
    var p;
    var salt;
    var iterations;
    var messageIDList;
    var userIDList;
    var encryptedTextList;
    var ivList;
    var datetimeList;
    var lastDatetime;
    var encryptionKey;
    var intervalEnabled = true;
    document.querySelector('#message').onkeyup = (e) => {
        if (e.keyCode === 13) {
            document.getElementById('send-message').click();
        }
    }
    document.querySelector('#private-key').onkeyup = (e) => {
        if (e.keyCode === 13) {
            document.getElementById('enter-private-key').click();
        }
    }
    window.onbeforeunload = () => {
        if (encryptionKey) {
            return '';
        }
    }
    getRoomData();
    setInterval(getNewMessages, 3000);
}
