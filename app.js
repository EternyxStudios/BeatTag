function renderCapture(){
  const a=$('#captureArea'); 
  if(!a)return;

  if(currentType==='text'){
    a.innerHTML='';
    stopStream();
    return;
  }

  const accept=
    currentType==='photo'
      ? 'image/*'
      : currentType==='video'
      ? 'video/*'
      : 'audio/*';

  a.innerHTML=`
    <div class="capture-box">

      <strong>
        ${
          currentType==='photo'
            ? '📷 Photo'
            : currentType==='video'
            ? '🎥 Video'
            : '🎙 Audio'
        }
      </strong>

      <div class="capture-actions">

        ${
          currentType!=='audio'
            ? `<button
                 type="button"
                 class="secondary"
                 onclick="openCamera('${currentType}')">
                 Open Camera
               </button>`
            : `<button
                 type="button"
                 class="secondary"
                 onclick="toggleAudioRecord()">
                 Start Recording
               </button>`
        }

        <button
          type="button"
          class="secondary"
          id="chooseFileBtn">
          Choose File
        </button>

        <input
          id="filePick"
          type="file"
          accept="${accept}"
          hidden
        >

      </div>

      <div
        class="capture-preview"
        id="preview">
      </div>

    </div>
  `;

  const chooseFileBtn=$('#chooseFileBtn');
  const filePick=$('#filePick');

  if(chooseFileBtn && filePick){

    chooseFileBtn.onclick=()=>{
      filePick.click();
    };

    filePick.onchange=e=>{
      const file=
        e.target.files &&
        e.target.files[0];

      if(file){
        fileChosen(file);
      }
    };
  }
}
