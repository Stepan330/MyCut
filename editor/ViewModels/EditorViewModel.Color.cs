using MyCut.Editor.Services;

namespace MyCut.Editor.ViewModels;
public sealed partial class EditorViewModel
{
    private void ChangeGrade(Action<SceneItem> change)
    {
        if(Selected is null)return;
        Execute(()=>{change(Selected);Engine.Grade(Selected);Changed();NotifyProperties();});
    }
    public double Exposure{get=>Selected?.Grade.Exposure??0;set=>ChangeGrade(i=>i.Grade.Exposure=(float)value);}
    public double Contrast{get=>Selected?.Grade.Contrast??1;set=>ChangeGrade(i=>i.Grade.Contrast=(float)value);}
    public double Saturation{get=>Selected?.Grade.Saturation??1;set=>ChangeGrade(i=>i.Grade.Saturation=(float)value);}
    public double Temperature{get=>Selected?.Grade.Temperature??0;set=>ChangeGrade(i=>i.Grade.Temperature=(float)value);}
    public double ColorTint{get=>Selected?.Grade.Tint??0;set=>ChangeGrade(i=>i.Grade.Tint=(float)value);}
    public double ContrastPivot{get=>Selected?.Grade.Pivot??.18;set=>ChangeGrade(i=>i.Grade.Pivot=(float)value);}
    public double LiftRed{get=>Selected?.Grade.LiftR??0;set=>ChangeGrade(i=>i.Grade.LiftR=(float)value);}
    public double LiftGreen{get=>Selected?.Grade.LiftG??0;set=>ChangeGrade(i=>i.Grade.LiftG=(float)value);}
    public double LiftBlue{get=>Selected?.Grade.LiftB??0;set=>ChangeGrade(i=>i.Grade.LiftB=(float)value);}
    public double GammaRed{get=>Selected?.Grade.GammaR??1;set=>ChangeGrade(i=>i.Grade.GammaR=(float)value);}
    public double GammaGreen{get=>Selected?.Grade.GammaG??1;set=>ChangeGrade(i=>i.Grade.GammaG=(float)value);}
    public double GammaBlue{get=>Selected?.Grade.GammaB??1;set=>ChangeGrade(i=>i.Grade.GammaB=(float)value);}
    public double GainRed{get=>Selected?.Grade.GainR??1;set=>ChangeGrade(i=>i.Grade.GainR=(float)value);}
    public double GainGreen{get=>Selected?.Grade.GainG??1;set=>ChangeGrade(i=>i.Grade.GainG=(float)value);}
    public double GainBlue{get=>Selected?.Grade.GainB??1;set=>ChangeGrade(i=>i.Grade.GainB=(float)value);}
    public double OffsetRed{get=>Selected?.Grade.OffsetR??0;set=>ChangeGrade(i=>i.Grade.OffsetR=(float)value);}
    public double OffsetGreen{get=>Selected?.Grade.OffsetG??0;set=>ChangeGrade(i=>i.Grade.OffsetG=(float)value);}
    public double OffsetBlue{get=>Selected?.Grade.OffsetB??0;set=>ChangeGrade(i=>i.Grade.OffsetB=(float)value);}
    public bool Grayscale{get=>Selected is {} i&&i.Grade.Grayscale!=0;set=>ChangeGrade(i=>i.Grade.Grayscale=value?1:0);}
    public bool Invert{get=>Selected is {} i&&i.Grade.Invert!=0;set=>ChangeGrade(i=>i.Grade.Invert=value?1:0);}
    public double LiftMaster
    {
        get=>Selected is {} i?(i.Grade.LiftR+i.Grade.LiftG+i.Grade.LiftB)/3:0;
        set=>ChangeGrade(i=>{float delta=(float)value-(i.Grade.LiftR+i.Grade.LiftG+i.Grade.LiftB)/3;i.Grade.LiftR=Math.Clamp(i.Grade.LiftR+delta,-1,1);i.Grade.LiftG=Math.Clamp(i.Grade.LiftG+delta,-1,1);i.Grade.LiftB=Math.Clamp(i.Grade.LiftB+delta,-1,1);});
    }
    public double GammaMaster
    {
        get=>Selected is {} i?(i.Grade.GammaR+i.Grade.GammaG+i.Grade.GammaB)/3:1;
        set=>ChangeGrade(i=>{float factor=(float)value/((i.Grade.GammaR+i.Grade.GammaG+i.Grade.GammaB)/3);i.Grade.GammaR=Math.Clamp(i.Grade.GammaR*factor,.01f,4);i.Grade.GammaG=Math.Clamp(i.Grade.GammaG*factor,.01f,4);i.Grade.GammaB=Math.Clamp(i.Grade.GammaB*factor,.01f,4);});
    }
    public double GainMaster
    {
        get=>Selected is {} i?(i.Grade.GainR+i.Grade.GainG+i.Grade.GainB)/3:1;
        set=>ChangeGrade(i=>{float average=(i.Grade.GainR+i.Grade.GainG+i.Grade.GainB)/3;if(average<.001f){i.Grade.GainR=i.Grade.GainG=i.Grade.GainB=(float)value;return;}float factor=(float)value/average;i.Grade.GainR=Math.Clamp(i.Grade.GainR*factor,0,8);i.Grade.GainG=Math.Clamp(i.Grade.GainG*factor,0,8);i.Grade.GainB=Math.Clamp(i.Grade.GainB*factor,0,8);});
    }
    public double OffsetMaster
    {
        get=>Selected is {} i?(i.Grade.OffsetR+i.Grade.OffsetG+i.Grade.OffsetB)/3:0;
        set=>ChangeGrade(i=>{float delta=(float)value-(i.Grade.OffsetR+i.Grade.OffsetG+i.Grade.OffsetB)/3;i.Grade.OffsetR=Math.Clamp(i.Grade.OffsetR+delta,-1,1);i.Grade.OffsetG=Math.Clamp(i.Grade.OffsetG+delta,-1,1);i.Grade.OffsetB=Math.Clamp(i.Grade.OffsetB+delta,-1,1);});
    }
}
