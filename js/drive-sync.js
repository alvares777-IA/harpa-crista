/**
 * GOOGLE DRIVE SYNC - Harpa Cristã
 * Gerencia backup e restauração de dados (favoritos, hinos personalizados)
 */

(function () {
    'use strict';

    // CONFIGURAÇÃO
    var CLIENT_ID = '169358736135-r4qemh4j0e4fb2o4b8ip5ej3gl4hua8n.apps.googleusercontent.com';
    var SCOPES = 'https://www.googleapis.com/auth/drive.file';
    var BACKUP_FILE_NAME = 'harpa_crista_backup.json';

    var gapiInited = false;
    var gsisInited = false;
    var tokenClient;
    var accessToken = null;

    // Elementos da UI
    var $statusText = $('#syncStatusText');
    var $btnConnect = $('#btnConnectDrive');
    var $btnBackup = $('#btnBackupToDrive');
    var $btnRestore = $('#btnRestoreFromDrive');
    var $userInfo = $('#driveUserInfo');

    function init() {
        if (!$('#btnExportFile').length) return; // Só roda na página Sobre

        loadScripts();
        setupEvents();
        setupFileBackup();
    }

    function setupFileBackup() {
        $('#btnExportFile').on('click', function () {
            var data = collectAllData();
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'backup_harpa_crista_' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        $('#btnImportFile').on('click', function () {
            $('#fileInput').click();
        });

        $('#fileInput').on('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;

            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (confirm('Deseja restaurar os dados deste arquivo? Isso sobrescreverá seus favoritos e edições atuais.')) {
                        Object.keys(data).forEach(key => {
                            if (key.startsWith('harpa_')) {
                                localStorage.setItem(key, data[key]);
                            }
                        });
                        alert('Dados restaurados com sucesso! A página será reiniciada.');
                        location.reload();
                    }
                } catch (err) {
                    alert('Erro ao ler arquivo: Certifique-se que é um arquivo de backup válido.');
                }
            };
            reader.readAsText(file);
        });
    }

    function loadScripts() {
        console.log('Iniciando carregamento de scripts do Google...');

        var gsiScript = document.createElement('script');
        gsiScript.src = 'https://accounts.google.com/gsi/client';
        gsiScript.onload = function () {
            console.log('GSI carregado.');

            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse) => {
                        if (tokenResponse.error !== undefined) {
                            console.error('Erro na Autenticação:', tokenResponse);
                            updateStatus('Erro Auth', 'text-danger');
                            throw (tokenResponse);
                        }
                        accessToken = tokenResponse.access_token;
                        localStorage.setItem('harpa_drive_token', accessToken);
                        onAuthSuccess();
                    },
                });
                gsisInited = true;
                checkInited();
            } catch (e) {
                console.warn('Google Drive não configurado corretamente para este domínio.');
            }
        };
        document.head.appendChild(gsiScript);

        var gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = function () {
            gapi.load('client', function () {
                gapi.client.init({
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                }).then(function () {
                    gapiInited = true;
                    checkInited();
                }).catch(err => {
                    console.error('Erro ao inicializar GAPI client:', err);
                });
            });
        };
        document.head.appendChild(gapiScript);
    }

    function checkInited() {
        if (gapiInited && gsisInited) {
            $btnConnect.prop('disabled', false);
            var savedToken = localStorage.getItem('harpa_drive_token');
            if (savedToken) {
                accessToken = savedToken;
                gapi.client.setToken({ access_token: accessToken });
                onAuthSuccess();
            }
        }
    }

    function setupEvents() {
        $btnConnect.on('click', function () {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        });

        $btnBackup.on('click', backupData);
        $btnRestore.on('click', restoreData);

        $('#btnDisconnectDrive').on('click', function (e) {
            e.preventDefault();
            localStorage.removeItem('harpa_drive_token');
            location.reload();
        });
    }

    function onAuthSuccess() {
        $btnConnect.addClass('d-none');
        $userInfo.removeClass('d-none');
        $btnBackup.prop('disabled', false);
        $btnRestore.prop('disabled', false);
        updateStatus('Conectado ao Google Drive', 'text-success');
    }

    function updateStatus(msg, className) {
        $statusText.text(msg).removeClass('text-success text-danger text-warning').addClass(className || '');
    }

    // Coleta todos os dados do localStorage da Harpa
    function collectAllData() {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key.startsWith('harpa_')) {
                data[key] = localStorage.getItem(key);
            }
        }
        return data;
    }

    async function backupData() {
        try {
            updateStatus('Iniciando backup...', 'text-warning');
            var data = collectAllData();
            var content = JSON.stringify(data);

            // 1. Procura se já existe o arquivo
            var search = await gapi.client.drive.files.list({
                q: "name = '" + BACKUP_FILE_NAME + "' and trashed = false",
                fields: 'files(id, name)'
            });

            var fileId = search.result.files.length > 0 ? search.result.files[0].id : null;

            if (fileId) {
                // Atualiza existente
                await gapi.client.request({
                    path: '/upload/drive/v3/files/' + fileId,
                    method: 'PATCH',
                    params: { uploadType: 'media' },
                    body: content
                });
            } else {
                // Cria novo
                const metadata = {
                    name: BACKUP_FILE_NAME,
                    mimeType: 'application/json'
                };
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";

                const multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    content +
                    close_delim;

                await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
                    body: multipartRequestBody
                });
            }

            updateStatus('Backup realizado com sucesso! (' + new Date().toLocaleTimeString() + ')', 'text-success');
            alert('Seus dados foram salvos no Google Drive com sucesso!');
        } catch (err) {
            console.error(err);
            if (err.status === 401) {
                updateStatus('Sessão expirada. Reconecte.', 'text-danger');
                $btnConnect.removeClass('d-none');
                $userInfo.addClass('d-none');
            } else {
                updateStatus('Erro ao realizar backup.', 'text-danger');
            }
        }
    }

    async function restoreData() {
        try {
            updateStatus('Buscando backup...', 'text-warning');

            var search = await gapi.client.drive.files.list({
                q: "name = '" + BACKUP_FILE_NAME + "' and trashed = false",
                fields: 'files(id, name, modifiedTime)'
            });

            if (search.result.files.length === 0) {
                updateStatus('Nenhum backup encontrado no Drive.', 'text-danger');
                alert('Não conseguimos encontrar nenhum arquivo de backup da Harpa no seu Google Drive.');
                return;
            }

            var file = search.result.files[0];
            var date = new Date(file.modifiedTime).toLocaleString();

            if (!confirm('Backup encontrado de ' + date + '.\n\nDeseja restaurar? Isso irá sobrescrever seus dados locais (favoritos e edições).')) {
                updateStatus('Restauração cancelada.', '');
                return;
            }

            var response = await gapi.client.drive.files.get({
                fileId: file.id,
                alt: 'media'
            });

            var data = response.result || JSON.parse(response.body);

            // Aplica os dados
            Object.keys(data).forEach(key => {
                localStorage.setItem(key, data[key]);
            });

            updateStatus('Dados restaurados com sucesso!', 'text-success');
            alert('Restauração concluída! A página será reiniciada.');
            location.reload();
        } catch (err) {
            console.error(err);
            updateStatus('Erro ao restaurar dados.', 'text-danger');
        }
    }

    // Init
    $(document).ready(init);
})();
