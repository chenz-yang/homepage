document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const qrDataInput = document.getElementById("qr-data");
  const colorTypeSelect = document.getElementById("color-type");
  const bgColorInput = document.getElementById("bg-color");
  const qrColorInput = document.getElementById("qr-color");
  const qrColor1Input = document.getElementById("qr-color-1");
  const qrColor2Input = document.getElementById("qr-color-2");
  const gradientTypeSelect = document.getElementById("gradient-type");
  const gradientAngleInput = document.getElementById("gradient-angle");
  
  const dotsTypeSelect = document.getElementById("dots-type");
  const cornersTypeSelect = document.getElementById("corners-type");
  const cornersDotTypeSelect = document.getElementById("corners-dot-type");
  const errorCorrectionSelect = document.getElementById("qr-error-correction");
  
  const logoFileInput = document.getElementById("logo-file");
  const removeLogoBtn = document.getElementById("remove-logo");
  const logoOptionsDiv = document.getElementById("logo-options");
  const logoSizeInput = document.getElementById("logo-size");
  const logoMarginInput = document.getElementById("logo-margin");
  
  const singleColorControls = document.getElementById("single-color-controls");
  const gradientColorControls = document.getElementById("gradient-color-controls");
  const gradientAngleGroup = document.getElementById("gradient-angle-group");
  
  const formatButtons = document.querySelectorAll(".format-btn");
  const downloadBtn = document.getElementById("btn-download");
  const copyBtn = document.getElementById("btn-copy");
  const canvasContainer = document.getElementById("qr-code-canvas");
  
  // App State
  let currentFormat = "png";
  let logoDataUrl = "";
  
  // Initialize QR Code Styling
  const qrCode = new QRCodeStyling({
    width: 280,
    height: 280,
    type: "svg", // Render as SVG inside container for sharpness
    data: qrDataInput.value,
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: errorCorrectionSelect.value
    },
    dotsOptions: {
      color: qrColorInput.value,
      type: dotsTypeSelect.value
    },
    backgroundOptions: {
      color: bgColorInput.value
    },
    imageOptions: {
      crossOrigin: "anonymous",
      hideBackgroundDots: true,
      imageSize: parseFloat(logoSizeInput.value),
      margin: parseInt(logoMarginInput.value)
    },
    cornersSquareOptions: {
      type: cornersTypeSelect.value,
      color: qrColorInput.value
    },
    cornersDotOptions: {
      type: cornersDotTypeSelect.value,
      color: qrColorInput.value
    }
  });

  // Render QR Code in the container
  qrCode.append(canvasContainer);

  // Helper: Update Hex label
  const updateHexLabel = (inputEl) => {
    const wrapper = inputEl.closest(".color-picker-wrapper");
    if (wrapper) {
      const hexSpan = wrapper.querySelector(".color-hex");
      if (hexSpan) {
        hexSpan.textContent = inputEl.value;
      }
    }
  };

  // Helper: Get color options (single or gradient) for update
  const getColorOptions = () => {
    const isGradient = colorTypeSelect.value === "gradient";
    const bgCol = bgColorInput.value;
    
    let dotsOptions = { type: dotsTypeSelect.value };
    let cornersSquareOptions = { type: cornersTypeSelect.value };
    let cornersDotOptions = { type: cornersDotTypeSelect.value };

    if (isGradient) {
      const gradType = gradientTypeSelect.value;
      const angleDeg = parseFloat(gradientAngleInput.value) || 0;
      const angleRad = (angleDeg * Math.PI) / 180;
      
      const gradientObj = {
        type: gradType,
        colorStops: [
          { offset: 0, color: qrColor1Input.value },
          { offset: 1, color: qrColor2Input.value }
        ]
      };
      
      if (gradType === "linear") {
        gradientObj.rotation = angleRad;
      }

      dotsOptions.gradient = gradientObj;
      // Note: We can also apply the gradient or start color to corners for visual coherence
      cornersSquareOptions.color = qrColor1Input.value;
      cornersDotOptions.color = qrColor2Input.value;
    } else {
      dotsOptions.color = qrColorInput.value;
      dotsOptions.gradient = null;
      
      cornersSquareOptions.color = qrColorInput.value;
      cornersDotOptions.color = qrColorInput.value;
    }

    return { dotsOptions, cornersSquareOptions, cornersDotOptions };
  };

  // Centralized update function
  const updateQRCode = () => {
    const { dotsOptions, cornersSquareOptions, cornersDotOptions } = getColorOptions();
    
    const updateOptions = {
      data: qrDataInput.value || " ",
      backgroundOptions: {
        color: bgColorInput.value
      },
      qrOptions: {
        errorCorrectionLevel: errorCorrectionSelect.value
      },
      dotsOptions,
      cornersSquareOptions,
      cornersDotOptions,
      image: logoDataUrl || null,
      imageOptions: {
        imageSize: parseFloat(logoSizeInput.value),
        margin: parseInt(logoMarginInput.value),
        hideBackgroundDots: true
      }
    };
    
    qrCode.update(updateOptions);
  };

  // Event Listeners for controls
  qrDataInput.addEventListener("input", updateQRCode);
  errorCorrectionSelect.addEventListener("change", updateQRCode);
  
  // Dots / Corners Styles
  dotsTypeSelect.addEventListener("change", updateQRCode);
  cornersTypeSelect.addEventListener("change", updateQRCode);
  cornersDotTypeSelect.addEventListener("change", updateQRCode);

  // Color Type Toggle
  colorTypeSelect.addEventListener("change", () => {
    if (colorTypeSelect.value === "gradient") {
      singleColorControls.classList.add("hidden");
      gradientColorControls.classList.remove("hidden");
    } else {
      singleColorControls.classList.remove("hidden");
      gradientColorControls.classList.add("hidden");
    }
    updateQRCode();
  });

  // Gradient Type Toggle
  gradientTypeSelect.addEventListener("change", () => {
    if (gradientTypeSelect.value === "radial") {
      gradientAngleGroup.classList.add("hidden");
    } else {
      gradientAngleGroup.classList.remove("hidden");
    }
    updateQRCode();
  });

  // Color inputs
  [bgColorInput, qrColorInput, qrColor1Input, qrColor2Input].forEach(picker => {
    picker.addEventListener("input", (e) => {
      updateHexLabel(e.target);
      updateQRCode();
    });
    // Init label
    updateHexLabel(picker);
  });

  gradientAngleInput.addEventListener("input", updateQRCode);

  // Logo file upload
  logoFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      logoDataUrl = event.target.result;
      
      // Update UI state
      removeLogoBtn.classList.remove("hidden");
      logoOptionsDiv.classList.remove("hidden");
      
      // Increase error correction level to High automatically for better scan reliability with logo
      errorCorrectionSelect.value = "H";
      
      updateQRCode();
    };
    reader.readAsDataURL(file);
  });

  // Remove Logo
  removeLogoBtn.addEventListener("click", () => {
    logoDataUrl = "";
    logoFileInput.value = "";
    removeLogoBtn.classList.add("hidden");
    logoOptionsDiv.classList.add("hidden");
    updateQRCode();
  });

  // Logo parameters sliders
  logoSizeInput.addEventListener("input", updateQRCode);
  logoMarginInput.addEventListener("input", updateQRCode);

  // Format Selector
  formatButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      formatButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFormat = btn.dataset.format;
    });
  });

  // Download QR Code
  downloadBtn.addEventListener("click", () => {
    // Generate file name from data URL domain
    let fileName = "qr-code";
    try {
      if (qrDataInput.value && qrDataInput.value.startsWith("http")) {
        const url = new URL(qrDataInput.value);
        fileName = `qr-${url.hostname.replace("www.", "")}`;
      }
    } catch(e) {
      // fallback
    }
    
    qrCode.download({
      name: fileName,
      extension: currentFormat
    });
  });

  // Copy to Clipboard
  copyBtn.addEventListener("click", async () => {
    try {
      // Find the canvas inside the generator
      const canvas = canvasContainer.querySelector("canvas");
      if (!canvas) {
        // If it rendered as svg, we draw it to a canvas temporary to copy it
        const svgElement = canvasContainer.querySelector("svg");
        if (svgElement) {
          const svgString = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
          const URL = window.URL || window.webkitURL || window;
          const blobURL = URL.createObjectURL(svgBlob);
          const image = new Image();
          
          image.onload = () => {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = svgElement.clientWidth || 280;
            tempCanvas.height = svgElement.clientHeight || 280;
            const context = tempCanvas.getContext("2d");
            
            // Draw background if any
            context.fillStyle = bgColorInput.value;
            context.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            context.drawImage(image, 0, 0);
            
            tempCanvas.toBlob(async (blob) => {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ [blob.type]: blob })
                ]);
                showCopySuccess();
              } catch (err) {
                console.error("Failed to copy image blob", err);
                fallbackCopyToClipboard();
              }
            }, "image/png");
          };
          image.src = blobURL;
          return;
        }
        
        throw new Error("No canvas or SVG element found to copy.");
      }

      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ]);
          showCopySuccess();
        } catch (err) {
          console.error("Failed to copy image blob", err);
          fallbackCopyToClipboard();
        }
      }, "image/png");
    } catch (err) {
      console.error("Copy failed", err);
      fallbackCopyToClipboard();
    }
  });

  const showCopySuccess = () => {
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Kopiert!
    `;
    copyBtn.style.background = "var(--accent)";
    copyBtn.style.color = "#0b0f19";
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      copyBtn.style.background = "";
      copyBtn.style.color = "";
    }, 2000);
  };

  const fallbackCopyToClipboard = () => {
    // If clipboard API fails or is not supported (e.g. insecure origin or old browser), we prompt the user
    alert("Das direkte Kopieren von Bildern wird von Ihrem Browser unter diesem Origin eventuell nicht unterstützt. Bitte nutzen Sie die Schaltfläche 'Herunterladen'.");
  };

  // Initial draw execution
  updateQRCode();
});
