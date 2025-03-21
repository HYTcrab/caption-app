import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Upload, 
  Button, 
  Input, 
  InputNumber, 
  ColorPicker, 
  Select, 
  Row, 
  Col, 
  message
} from 'antd';
import { UploadOutlined, SaveOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Color } from 'antd/es/color-picker';
import { saveAs } from 'file-saver';
import './App.css';

const { TextArea } = Input;

interface CaptionSettings {
  height: number;
  fontSize: number;
  fontColor: string;
  outlineColor: string;
  fontFamily: string;
  fontWeight: string;
  text: string;
}

function App() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
    height: 60, // 每行文字的高度
    fontSize: 45,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    fontFamily: 'system-ui',
    fontWeight: 'normal',
    text: '' // 不添加默认文字
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  
  // 使用防抖定时器引用
  const debounceTimerRef = useRef<number | null>(null);

  // 处理文件上传
  const handleFileChange = (info: any) => {
    const file = info.file;
    if (file.status === 'done' || file.status === 'uploading') {
      setFileList([file]);
      
      // 创建文件预览URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setImageUrl(url);
        
        // 获取图片尺寸
        const img = new Image();
        img.onload = () => {
          setImageSize({
            width: img.width,
            height: img.height
          });
          setBackgroundImage(img);
        };
        img.src = url;
      };
      reader.readAsDataURL(file.originFileObj);
    }
  };

  // 处理设置变更 - 使用防抖优化
  const handleSettingChange = useCallback((key: keyof CaptionSettings, value: any) => {
    setCaptionSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // 防抖处理文本输入
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    // 清除之前的定时器
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    
    // 设置新的定时器
    debounceTimerRef.current = window.setTimeout(() => {
      setCaptionSettings(prev => ({
        ...prev,
        text: newText
      }));
    }, 300); // 300ms的防抖延迟
  }, []);

  // 生成字幕图片
  const generateCaptionImage = useCallback(() => {
    if (!imageUrl || !canvasRef.current || !backgroundImage) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 分行绘制文本
    const lines = captionSettings.text.split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      // 如果没有文字，直接返回原图
      canvas.width = backgroundImage.width;
      canvas.height = backgroundImage.height;
      ctx.drawImage(backgroundImage, 0, 0);
      setPreviewUrl(canvas.toDataURL('image/png'));
      return;
    }
    
    // 计算字幕区域的总高度
    const totalCaptionHeight = lines.length * captionSettings.height;
    
    // 设置canvas尺寸 - 原始图片高度加上字幕区域高度
    canvas.width = backgroundImage.width;
    canvas.height = backgroundImage.height + totalCaptionHeight;
    
    // 绘制原始图片
    ctx.drawImage(backgroundImage, 0, 0);
    
    // 创建一个临时canvas来存储字幕的背景
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // 设置临时canvas的尺寸为一行字幕的高度
    tempCanvas.width = backgroundImage.width;
    tempCanvas.height = captionSettings.height;
    
    // 在临时canvas上绘制字幕的背景（从原图底部截取）
    tempCtx.drawImage(
      backgroundImage, 
      0, backgroundImage.height - captionSettings.height, 
      backgroundImage.width, captionSettings.height, 
      0, 0, 
      backgroundImage.width, captionSettings.height
    );
    
    // 给临时背景添加半透明黑色遮罩
    tempCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // 为每一行字幕绘制背景和文本
    lines.forEach((line, index) => {
      if (!line.trim()) return; // 跳过空行
      
      // 字幕的Y坐标 - 从原始图片底部开始
      const y = backgroundImage.height + index * captionSettings.height;
      
      // 使用相同的背景图作为每一行的背景
      ctx.drawImage(tempCanvas, 0, y);
      
      // 如果不是最后一行，绘制分割线
      if (index < lines.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + captionSettings.height);
        ctx.lineTo(backgroundImage.width, y + captionSettings.height);
        ctx.stroke();
      }
      
      // 设置文本样式
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${captionSettings.fontWeight} ${captionSettings.fontSize}px ${captionSettings.fontFamily}`;
      ctx.strokeStyle = captionSettings.outlineColor;
      ctx.lineWidth = 3;
      ctx.fillStyle = captionSettings.fontColor;
      
      // 绘制文本
      const textY = y + captionSettings.height / 2;
      ctx.strokeText(line, backgroundImage.width / 2, textY);
      ctx.fillText(line, backgroundImage.width / 2, textY);
    });
    
    // 更新预览URL - 使用较低质量以提高性能
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
  }, [imageUrl, captionSettings, backgroundImage]);

  // 使用requestAnimationFrame优化渲染
  useEffect(() => {
    if (imageUrl && backgroundImage) {
      // 使用requestAnimationFrame来优化渲染
      const animationId = requestAnimationFrame(() => {
        generateCaptionImage();
      });
      
      return () => {
        // 清理
        cancelAnimationFrame(animationId);
      };
    }
  }, [imageUrl, captionSettings, backgroundImage, generateCaptionImage]);

  // 保存图片 - 使用高质量输出
  const saveImage = useCallback(() => {
    if (!previewUrl || !canvasRef.current || !backgroundImage) {
      message.error('请先生成字幕图片');
      return;
    }
    
    // 保存时重新生成高质量图片
    const canvas = canvasRef.current;
    const highQualityImage = canvas.toDataURL('image/png');
    
    // 使用file-saver库保存图片
    saveAs(highQualityImage, 'caption-image.png');
  }, [previewUrl, backgroundImage]);

  // 计算图片预览的样式 - 使用useMemo优化计算
  const imagePreviewStyle = useMemo(() => {
    if (!imageSize.width || !imageSize.height) {
      return {
        maxWidth: '100%',
        maxHeight: 'none',
        objectFit: 'contain' as const
      };
    }

    // 保持原始图片尺寸，不进行缩放
    return {
      maxWidth: '100%',
      width: 'auto',
      height: 'auto',
      objectFit: 'contain' as const
    };
  }, [imageSize]);

  // 自定义上传组件
  const customUpload = useCallback(({ file: _, onSuccess }: any) => {
    setTimeout(() => {
      onSuccess("ok");
    }, 0);
  }, []);

  return (
    <div className="app-container">
      <div className="content-container">
        <div className="app-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="3" fill="#1890ff" opacity="0.1"/>
            <path d="M21 3H3C1.9 3 1 3.9 1 5V19C1 20.1 1.9 21 3 21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3ZM21 19H3V5H21V19ZM13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z" fill="#1890ff"/>
            <rect x="4" y="20" width="16" height="2" rx="1" fill="#1890ff"/>
          </svg>
          <span className="app-logo-text">图片字幕工具</span>
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <div className="app-card" style={{ height: 'auto' }}>
              <div className="ant-card-head">
                <div className="ant-card-head-wrapper">
                  <div className="ant-card-head-title">字幕设置</div>
                </div>
              </div>
              <div className="ant-card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="form-section">
                  <div className="form-label">上传图片</div>
                  <Upload
                    customRequest={customUpload}
                    fileList={fileList}
                    onChange={handleFileChange}
                    maxCount={1}
                    accept="image/*"
                    listType="picture"
                    className="upload-container"
                  >
                    <Button icon={<UploadOutlined />} size="large" className="primary-button" style={{ width: '100%' }}>
                      选择图片
                    </Button>
                  </Upload>
                </div>

                <div className="form-section">
                  <div className="form-label">字幕设置</div>
                  <div className="settings-grid">
                    <div className="setting-item">
                      <div className="setting-label">每行字幕高度</div>
                      <InputNumber
                        value={captionSettings.height}
                        onChange={(value) => handleSettingChange('height', value)}
                        min={30}
                        max={200}
                        addonAfter="px"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="setting-item">
                      <div className="setting-label">字体大小</div>
                      <InputNumber
                        value={captionSettings.fontSize}
                        onChange={(value) => handleSettingChange('fontSize', value)}
                        min={10}
                        max={200}
                        addonAfter="px"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="setting-item">
                      <div className="setting-label">字体颜色</div>
                      <ColorPicker
                        value={captionSettings.fontColor}
                        onChange={(color: Color) => handleSettingChange('fontColor', color.toHexString())}
                        showText
                      />
                    </div>
                    <div className="setting-item">
                      <div className="setting-label">轮廓颜色</div>
                      <ColorPicker
                        value={captionSettings.outlineColor}
                        onChange={(color: Color) => handleSettingChange('outlineColor', color.toHexString())}
                        showText
                      />
                    </div>
                    <div className="setting-item">
                      <div className="setting-label">字体样式</div>
                      <Select
                        value={captionSettings.fontFamily}
                        onChange={(value) => handleSettingChange('fontFamily', value)}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'system-ui', label: '系统默认' },
                          { value: 'Arial', label: 'Arial' },
                          { value: 'Verdana', label: 'Verdana' },
                          { value: 'Times New Roman', label: 'Times New Roman' },
                          { value: 'Courier New', label: 'Courier New' },
                          { value: 'SimSun', label: '宋体' },
                          { value: 'Microsoft YaHei', label: '微软雅黑' }
                        ]}
                      />
                    </div>
                    <div className="setting-item">
                      <div className="setting-label">字体粗细</div>
                      <Select
                        value={captionSettings.fontWeight}
                        onChange={(value) => handleSettingChange('fontWeight', value)}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'normal', label: '正常' },
                          { value: 'bold', label: '粗体' },
                          { value: '300', label: '细体' },
                          { value: '600', label: '中粗' },
                          { value: '900', label: '特粗' }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-label">字幕内容</div>
                  <TextArea
                    defaultValue={captionSettings.text}
                    onChange={handleTextChange}
                    placeholder="输入字幕内容，每行将单独显示在图片上"
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    className="caption-textarea"
                  />
                </div>

                <div className="form-section action-section">
                  <Button 
                    onClick={saveImage} 
                    icon={<SaveOutlined />}
                    style={{ width: '100%' }}
                    disabled={!previewUrl}
                    size="large"
                    type="primary"
                    className="primary-button"
                  >
                    保存图片
                  </Button>
                </div>
              </div>
            </div>
          </Col>

          <Col xs={24} lg={12}>
            <div className="app-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="ant-card-head">
                <div className="ant-card-head-wrapper">
                  <div className="ant-card-head-title">预览区域</div>
                </div>
              </div>
              <div className="ant-card-body" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <div className="preview-container fade-in">
                  {imageUrl ? (
                    previewUrl ? (
                      <div className="image-preview-wrapper">
                        <img 
                          src={previewUrl} 
                          alt="预览" 
                          style={imagePreviewStyle}
                          className="fade-in"
                        />
                      </div>
                    ) : (
                      <div className="preview-placeholder">
                        正在生成预览...
                      </div>
                    )
                  ) : (
                    <div className="preview-placeholder">
                      <div style={{ marginBottom: '16px' }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z" fill="#8c8c8c"/>
                        </svg>
                      </div>
                      请上传图片以查看预览效果
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 隐藏的Canvas用于图像处理 */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;
