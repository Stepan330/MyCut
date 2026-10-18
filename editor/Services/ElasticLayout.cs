namespace MyCut.Editor.Services;
public static class ElasticLayout
{
    // Conserves the strip's total extent: a growing item borrows room from its neighbours.
    public static double[] Allocate(IReadOnlyList<double> natural,IReadOnlyList<double> emphasis,double growth,double available,double minimum)
    {
        int count=natural.Count;if(count==0)return [];double total=Math.Min(available,natural.Sum());var sizes=new double[count];double sum=0;
        double floor=Math.Min(minimum,total/count);
        for(int i=0;i<count;++i){double weight=1+growth*Math.Clamp(emphasis[i],0,1);sizes[i]=Math.Max(.001,natural[i]-floor)*weight;sum+=sizes[i];}
        double remaining=Math.Max(0,total-floor*count);for(int i=0;i<count;++i)sizes[i]=floor+remaining*sizes[i]/sum;
        return sizes;
    }
}
