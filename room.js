var userID;
var encryptedName;
var recipientEncryptedName;
var p;
var salt;
var keySize;
var iterations;
var recipientPublicKey;
var messageIDList;
var userIDList;
var encryptedTextList;
var datetimeList;
var lastDatetime;
var encryptionKey;
var intervalEnabled = true;
const roomName = document.getElementById('room-name').value;
const csrfToken = document.getElementsByName('csrfmiddlewaretoken')[0].value;


function getRoomData() {
    axios({
        method: 'post',
        url: `/rooms/${roomName}`,
        headers: {
            'X-CSRFToken': csrfToken
        },
        data: {
            getRoomData: true
        }
    }).then((res) => {
        userID = res.data['userID']
        encryptedName = res.data['encryptedName']
        recipientEncryptedName = res.data['recipientEncryptedName']
        p = res.data['p']
        salt = CryptoJS.enc.Base64.parse(res.data['salt'])
        keySize = parseInt(res.data['keySize'])
        iterations = parseInt(res.data['iterations'])
        recipientPublicKey = res.data['recipientPublicKey']
        messageIDList = res.data['messageIDList']
        userIDList = res.data['userIDList']
        encryptedTextList = res.data['encryptedTextList']
        datetimeList = res.data['datetimeList']
        lastDatetime = res.data['lastDatetime']
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
        const x = document.getElementById('enter-private-key').innerHTML;
        document.getElementById('enter-private-key').innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${x}`;
        setTimeout(function() {
            try {
                const sharedSecretKey = bigInt(recipientPublicKey).modPow(privateKey, p).toString();
                encryptionKey = CryptoJS.PBKDF2(sharedSecretKey, salt, {
                    keySize: keySize,
                    iterations: iterations
                });
                if (encryptedTextList.length > 0) {
                    document.getElementById('messages').innerHTML = '';
                    for (let i = 0; i < encryptedTextList.length; i++) {
                        let plaintext;
                        try {
                            plaintext = decrypt(encryptedTextList[i]);
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
                    document.getElementById('encrypted-name').value = decrypt(encryptedName);
                }
                if (recipientEncryptedName) {
                    document.getElementById('recipient-encrypted-name').innerHTML = decrypt(recipientEncryptedName);
                }
                const privateKeyModal = bootstrap.Modal.getInstance(document.getElementById('private-key-modal'));
                privateKeyModal.hide();
                document.getElementById('send-message').classList.remove('d-none');
                document.getElementById('message').disabled = false;
            }
            catch (error) {}
            document.getElementById('enter-private-key').innerHTML = x;
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
            url: `/rooms/${roomName}`,
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
                    datetimeList.push(res.data['datetimeList'][i]);
                    if (encryptionKey) {
                        const plaintext = decrypt(res.data['encryptedTextList'][i]);
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
            const ciphertext = encrypt(message);
            axios({
                method: 'post',
                url: `/rooms/${roomName}`,
                headers: {
                    'X-CSRFToken': csrfToken
                },
                data: {
                    ciphertext: ciphertext
                }
            }).then((res) => {
                if (res.data['datetime']) {
                    document.getElementById('message').value = '';
                }
                else {
                    alert('Error: limit exceeded');
                }
                intervalEnabled = true;
                getNewMessages();
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
            const ciphertext = encrypt(eName);
            axios({
                method: 'post',
                url: `/rooms/${roomName}`,
                headers: {
                    'X-CSRFToken': csrfToken
                },
                data: {
                    setName: ciphertext
                }
            }).then((res) => {
                if (res.data['success']) {
                    document.getElementById('encrypted-name').value = eName;
                }
            });
        }
    }
}


function encrypt(plaintext) {
    const ciphertext = CryptoJS.AES.encrypt(plaintext, encryptionKey, {iv: salt}).toString();
    return ciphertext
}


function decrypt(ciphertext) {
    const plaintext = CryptoJS.AES.decrypt(ciphertext, encryptionKey, {iv: salt}).toString(CryptoJS.enc.Utf8);
    return plaintext
}


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
