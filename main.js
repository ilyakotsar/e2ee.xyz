async function postData(url = '', data = {}) {
	let options = {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			'X-CSRFToken': csrfToken,
		},
		referrerPolicy: 'no-referrer',
		body: JSON.stringify(data),
	};
	let response = await fetch(url, options);
	return response.json();
}

function createRoom() {
	let url;
	if (document.getElementById('link')) {
		url = `/create/${document.getElementById('link').value}`;
	}
	else {
		url = '/create';
	}
	postData(url, {create: ''}).then(response => {
		let g = response['g'];
		let p = response['p'];
		document.getElementById('g').value = g;
		document.getElementById('p').value = p;
		document.getElementById('g-display').innerHTML = `g = ${g}`;
		document.getElementById('p-display').innerHTML = `p = ${p}`;
		document.getElementById('spinner').classList.add('d-none');
		document.getElementById('generate-keys-btn').classList.remove('d-none');
		document.getElementById('create-room-form').classList.remove('d-none');
	});
}

function generateKeys() {
	let min = 240;
	let max = 250;
	let privateKeyLength = Math.floor(Math.random() * (max - min) + min);
	let privateKey = '';
	for (let i = 0; i < privateKeyLength; i++) {
		let digit = Math.floor(Math.random() * 10);
		privateKey += digit.toString();
	}
	hiddenPrivateKey = '';
	for (let i = 0; i < 150; i++) {
		hiddenPrivateKey += '*';
	}
	let g = document.getElementById('g').value;
	let p = document.getElementById('p').value;
	let publicKey = bigInt(g).modPow(privateKey, p).toString();
	document.getElementById('private-key').value = privateKey;
	document.getElementById('hidden-private-key').value = hiddenPrivateKey;
	document.getElementById('private-key-display').value = hiddenPrivateKey;
	document.getElementById('public-key').value = publicKey;
	let name = document.getElementById('public-key-name').value;
	document.getElementById('public-key-display').innerHTML = `${name}: ${publicKey}`;
	document.getElementById('generate-keys-btn').classList.add('d-none');
	document.getElementById('private-key-div').classList.remove('d-none');
	document.getElementById('create-room-btn').classList.remove('d-none');
}

function encryptText(plaintext, iv) {
	let ciphertext = CryptoJS.AES.encrypt(plaintext, encryptionKey, {iv: iv});
	return ciphertext.toString();
}

function decryptText(ciphertext, ivBase64) {
	let iv = CryptoJS.enc.Base64.parse(ivBase64);
	let plaintext = CryptoJS.AES.decrypt(ciphertext, encryptionKey, {iv: iv});
	return plaintext.toString(CryptoJS.enc.Utf8);
}

function getRoomData() {
	postData(`/rooms/${roomNumber}`, {getRoomData: ''}).then(response => {
		userID = response['userID'];
		encryptedName = response['encryptedName'];
		nameIV = response['nameIV'];
		recipientEncryptedName = response['recipientEncryptedName'];
		recipientIV = response['recipientIV'];
		recipientPublicKey = response['recipientPublicKey'];
		p = response['p'];
		salt = CryptoJS.enc.Base64.parse(response['salt']);
		iterations = response['iterations'];
		messageIDList = response['messageIDList'];
		senderIDList = response['senderIDList'];
		encryptedTextList = response['encryptedTextList'];
		messageIVList = response['messageIVList'];
		datetimeList = response['datetimeList'];
		lastDatetime = response['lastDatetime'];
		document.getElementById('encrypted-name').value = encryptedName;
		document.getElementById('recipient-encrypted-name').innerHTML = recipientEncryptedName;
		let messages = document.getElementById('messages');
		messages.innerHTML = '';
		if (encryptedTextList.length > 0) {
			for (let i = 0; i < encryptedTextList.length; i++) {
				displayMessage(
					messageIDList[i],
					senderIDList[i],
					encryptedTextList[i],
					datetimeList[i],
					'encrypted'
				);
			}
		}
		messages.scrollTop = messages.scrollHeight;
		let privateKeyModal = new bootstrap.Modal(document.getElementById('private-key-modal'));
		privateKeyModal.show();
		setTimeout(() => {
			document.getElementById('private-key').focus();
		}, '100');
	});
}

function enterPrivateKey() {
	let privateKey = document.getElementById('private-key').value.trim();
	if (privateKey.length > 0) {
		intervalEnabled = false;
		document.getElementById('enter-private-key').disabled = true;
		let buttonText = document.getElementById('enter-private-key').innerHTML;
		document.getElementById('enter-private-key').innerHTML = `${spinner}${buttonText}`;
		setTimeout(function() {
			try {
				let sharedSecretKey = bigInt(recipientPublicKey).modPow(privateKey, p).toString();
				encryptionKey = CryptoJS.PBKDF2(sharedSecretKey, salt, {
					keySize: 256 / 32,
					iterations: iterations
				});
				if (encryptedTextList.length > 0) {
					document.getElementById('messages').innerHTML = '';
					for (let i = 0; i < encryptedTextList.length; i++) {
						let plaintext;
						try {
							plaintext = decryptText(encryptedTextList[i], messageIVList[i]);
						}
						catch (error) {}
						if (plaintext) {
							displayMessage(
								messageIDList[i],
								senderIDList[i],
								plaintext,
								datetimeList[i],
							);
						}
						else {
							displayMessage(
								messageIDList[i],
								senderIDList[i],
								encryptedTextList[i],
								datetimeList[i],
								'encrypted'
							);
						}
					}
				}
				if (encryptedName) {
					let name = decryptText(encryptedName, nameIV);
					document.getElementById('encrypted-name').value = name;
				}
				if (recipientEncryptedName) {
					let recipientName = decryptText(recipientEncryptedName, recipientIV);
					document.getElementById('recipient-encrypted-name').innerHTML = recipientName;
				}
				let privateKeyModal = bootstrap.Modal.getInstance(document.getElementById('private-key-modal'));
				privateKeyModal.hide();
				document.getElementById('send-message').classList.remove('d-none');
				document.getElementById('message').disabled = false;
			}
			catch (error) {}
			document.getElementById('enter-private-key').innerHTML = buttonText;
			document.getElementById('enter-private-key').disabled = false;
			intervalEnabled = true;
		}, 10);
	}
	else {
		document.getElementById('private-key').value = '';
	}
}

function getNewMessages() {
	if (intervalEnabled) {
		postData(`/rooms/${roomNumber}`, {lastDatetime: lastDatetime}).then(response => {
			if (response['lastDatetime']) {
				for (let i = 0; i < response['encryptedTextList'].length; i++) {
					messageIDList.push(response['messageIDList'][i]);
					senderIDList.push(response['senderIDList'][i]);
					encryptedTextList.push(response['encryptedTextList'][i]);
					messageIVList.push(response['messageIVList'][i]);
					datetimeList.push(response['datetimeList'][i]);
					if (encryptionKey) {
						try {
							let plaintext = decryptText(
								response['encryptedTextList'][i],
								response['messageIVList'][i]
							);
							displayMessage(
								response['messageIDList'][i],
								response['senderIDList'][i],
								plaintext,
								response['datetimeList'][i]
							);                            
						}
						catch (error) {}
					}
					else {
						displayMessage(
							response['messageIDList'][i],
							response['senderIDList'][i],
							response['encryptedTextList'][i],
							response['datetimeList'][i],
							'encrypted'
						);
					}
				}
				lastDatetime = response['lastDatetime'];
				let messages = document.getElementById('messages');
				messages.scrollTop = messages.scrollHeight;
			}
		});
	}
}

function sendMessage() {
	if (encryptionKey) {
		let message = document.getElementById('message').value.trim();
		if (message !== '' && message.length < 3000) {
			intervalEnabled = false;
			let iv = CryptoJS.lib.WordArray.random(128 / 8);
			let ciphertext = encryptText(message, iv);
			let data = {
				ciphertext: ciphertext,
				iv: iv.toString(CryptoJS.enc.Base64)
			}
			postData(`/rooms/${roomNumber}`, data).then(response => {
				if (response['sent']) {
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
		let privateKeyModal = new bootstrap.Modal(document.getElementById('private-key-modal'));
		privateKeyModal.show();
	}
	document.getElementById('send-message').blur();
}

function displayMessage(messageID, senderID, text, datetime, mode) {
	let dt = new Date(datetime);
	let formattedDatetime = formatDatetime(dt);
	let fullDatetime = dt.toString();
	let lock = '<i class="fa-solid fa-lock"></i>';
	let messageType;
	if (senderID === userID) {
		messageType = 'my-message';
	}
	else {
		messageType = 'other-message';
	}
	let output;
	if (mode === 'encrypted') {
		output = `
		<div class="${messageType}">
			<div class="message-body word-break-all">
				${lock}
				<span id="${messageID}">${text}</span>
				<div class="datetime">
					<span
						data-bs-toggle="tooltip"
						data-bs-placement="top"
						data-bs-trigger="hover click"
						data-bs-custom-class="custom-tooltip"
						data-bs-title="${fullDatetime}"
					>
					${formattedDatetime}
					</span>
				</div>
			</div>
		</div>`;
	}
	else {
		output = `
		<div class="${messageType} dropdown">
			<button type="button" class="message-body" data-bs-toggle="dropdown">
				<span id="${messageID}">${text}</span>
				<div class="datetime">
					<span
						data-bs-toggle="tooltip"
						data-bs-placement="top"
						data-bs-custom-class="custom-tooltip"
						data-bs-title="${fullDatetime}"
					>
					${formattedDatetime}
					</span>
				</div>
			</button>
			<ul class="dropdown-menu dropdown-menu-end rounded-3 p-2 shadow">
				<li>
					<button type="button" onclick="copyMessage(${messageID})" class="dropdown-item rounded p-2">
						Copy
					</button>
				</li>
			</ul>
		</div>`;
	}
	document.getElementById('messages').innerHTML += output;
	enableTooltips();
}

function changeName() {
	if (encryptionKey) {
		let newName = document.getElementById('encrypted-name').value.trim();
		if (newName != '' && newName.length < 25) {
			let iv = CryptoJS.lib.WordArray.random(128 / 8);
			let ciphertext = encryptText(newName, iv);
			let data = {
				setName: ciphertext,
				iv: iv.toString(CryptoJS.enc.Base64)
			}
			postData(`/rooms/${roomNumber}`, data).then(response => {
				document.getElementById('encrypted-name').value = newName;
			});
		}
	}
}

function copyInput(btn, inputID, translatedCopy, translatedCopied) {
	let text = document.getElementById(inputID).value;
	navigator.clipboard.writeText(text).then(() => {
		if (translatedCopy && translatedCopied) {
			btn.innerHTML = translatedCopied;
			setTimeout(() => {
				btn.innerHTML = translatedCopy;
			}, '1500');
		}
		else {
			btn.innerHTML = '<i class="fa-solid fa-check"></i>';
			setTimeout(() => {
				btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
			}, '1500');
		}
	});
	btn.blur();
}

function copyMessage(id) {
	let text = document.getElementById(id).innerHTML;
	navigator.clipboard.writeText(text).then(() => {});
}

function switchPrivateKey(btn) {
	let privateKeyDisplay = document.getElementById('private-key-display');
	let privateKey = document.getElementById('private-key');
	let hiddenPrivateKey = document.getElementById('hidden-private-key');
	if (privateKeyDisplay.value.includes('*')) {
		privateKeyDisplay.value = privateKey.value;
		btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
	}
	else {
		privateKeyDisplay.value = hiddenPrivateKey.value;
		btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
	}
	btn.blur();
}

function switchPassword(btn, input) {
	let password = document.getElementById(input);
	if (password.type === 'password') {
		password.type = 'text';
		btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
	}
	else {
		password.type = 'password';
		btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
	}
	btn.blur();
}

function switchTheme(btn) {
	postData('/switch-theme').then(response => {
		document.body.className = `${response['theme']}-theme`;
		btn.blur();
	});
}

function addSpinner(btn, form) {
	if (form) {
		let f = document.getElementById(form);
		f.onsubmit = () => {
			btn.disabled = true;
			let x = btn.innerHTML;
			btn.innerHTML = `${spinner}${x}`;
		}
	}
	else {
		btn.disabled = true;
		let buttonText = btn.innerHTML;
		btn.innerHTML = `${spinner}${buttonText}`;
	}
}

function changeScreen() {
	let encrypted = document.getElementById('encrypted');
	let decrypted = document.getElementById('decrypted');
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

function formatDatetime(List) {
	let time = List.toLocaleTimeString('en-GB');
	return time.slice(0, 5);
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
	let buttonText = btn.innerHTML;
	btn.innerHTML = `${spinner}${buttonText}`;
	postData('/account', {showAccessKey: ''}).then(response => {
		document.getElementById('access-key-display').innerHTML = response['accessKey'];
		btn.classList.add('d-none');
	});
}

function enableTooltips() {
	let tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
	[...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

var csrfToken = document.getElementsByName('csrfmiddlewaretoken')[0].value;
var spinner = '<span class="spinner-border spinner-border-sm me-1"></span>';

if (window.location.pathname === '/') {
	let now = new Date();
	let formattedDatetime = formatDatetime(now);
	let dt = document.getElementsByName('datetime');
	for (let i = 0; i < dt.length; i++) {
		dt[i].innerHTML = formattedDatetime;
		dt[i].setAttribute('data-bs-toggle', 'tooltip');
		dt[i].setAttribute('data-bs-placement', 'top');
		dt[i].setAttribute('data-bs-custom-class', 'custom-tooltip');
		dt[i].setAttribute('data-bs-title', now.toString());
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
	var nameIV;
	var recipientEncryptedName;
	var recipientIV;
	var recipientPublicKey;
	var p;
	var salt;
	var iterations;
	var messageIDList;
	var senderIDList;
	var encryptedTextList;
	var messageIVList;
	var datetimeList;
	var lastDatetime;
	var encryptionKey;
	document.querySelector('#message').onkeyup = (event) => {
		if (event.keyCode === 13) {
			document.getElementById('send-message').click();
		}
	}
	document.querySelector('#private-key').onkeyup = (event) => {
		if (event.keyCode === 13) {
			document.getElementById('enter-private-key').click();
		}
	}
	window.onbeforeunload = () => {
		if (encryptionKey) {
			return '';
		}
	}
	getRoomData();
	var intervalEnabled = true;
	setInterval(getNewMessages, 3000);
}

enableTooltips();
